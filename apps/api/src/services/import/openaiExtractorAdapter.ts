import type { ArchitecturalImportSnapshot } from '@2wix/shared-types';
import type {
  ArchitecturalExtractionInput,
  ArchitecturalExtractorAdapter,
} from './extractorAdapter.js';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o';

const SYSTEM_PROMPT = `You are an expert architectural plan analyzer specializing in SIP (Structural Insulated Panel) construction.
Analyze the provided floor plan image(s) and extract structural information.

Return ONLY valid JSON — no markdown, no explanation, no code blocks — matching this exact structure:

{
  "projectMeta": {
    "name": "string (optional, project name if visible)",
    "detectedScaleHints": ["string (e.g. '1:100', '1 cell = 500mm')"],
    "notes": ["string"]
  },
  "floors": [
    {
      "id": "floor-1",
      "label": "Floor 1",
      "elevationHintMm": null,
      "confidence": { "score": 0.9, "level": "high" }
    }
  ],
  "outerContour": {
    "kind": "polygon",
    "points": [{"x": 0, "y": 0}, ...],
    "confidence": { "score": 0.85, "level": "high" }
  },
  "walls": [
    {
      "id": "wall-1",
      "floorId": "floor-1",
      "points": [{"x": 0, "y": 0}, {"x": 5000, "y": 0}],
      "typeHint": "external",
      "thicknessHintMm": 163,
      "confidence": { "score": 0.9, "level": "high" }
    }
  ],
  "openings": [
    {
      "id": "opening-1",
      "floorId": "floor-1",
      "wallId": "wall-1",
      "type": "window",
      "positionAlongWallMm": 1000,
      "widthMm": 1200,
      "heightMm": 1400,
      "confidence": { "score": 0.8, "level": "high" }
    }
  ],
  "stairs": [],
  "roofHints": {
    "likelyType": "gabled",
    "confidence": { "score": 0.7, "level": "medium" },
    "notes": []
  },
  "dimensions": [],
  "unresolved": [],
  "notes": ["string"]
}

IMPORTANT RULES:
1. ALL measurements must be in MILLIMETERS (mm).
2. Look for dimension labels/annotations on the plan (e.g. "5287", "14600") — these are usually in mm.
3. Use wall centerlines for point coordinates.
4. Place the origin (0,0) at the bottom-left corner of the outer contour.
5. For walls: trace each wall segment as a series of {x,y} points (polyline).
6. External walls form the building perimeter; internal walls divide rooms.
7. SIP panel walls are typically 163mm thick (exterior) or 114mm (interior).
8. If dimension labels are present, use them to establish the coordinate scale.
9. Mark doors as type "door" and windows as type "window".
10. If you cannot determine a value with confidence, set it to null.
11. "confidence.level": "high" if score >= 0.75, "medium" if >= 0.5, else "low".
12. For multi-floor plans, create separate floor entries and assign walls to their floor.
13. The "unresolved" array should list any issues blocking a complete extraction.
14. If no scale can be determined, add an unresolved issue with code "SCALE_UNKNOWN".`;

interface OpenAiMessage {
  role: 'system' | 'user';
  content: string | OpenAiContentPart[];
}

interface OpenAiContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string; detail: 'high' | 'low' | 'auto' };
}

function buildImageUrl(asset: { mimeType?: string; base64Data: string }): string {
  const mime = asset.mimeType ?? 'image/png';
  return `data:${mime};base64,${asset.base64Data}`;
}

function buildUserMessage(
  input: ArchitecturalExtractionInput
): OpenAiMessage {
  const parts: OpenAiContentPart[] = [];

  const imagesWithData = input.sourceImages.filter(
    (img) => img.base64Data && img.base64Data.length > 0
  );

  if (imagesWithData.length === 0) {
    parts.push({
      type: 'text',
      text: `No images provided. Project: "${input.projectName ?? 'unknown'}". Return a minimal snapshot with an unresolved issue code "NO_IMAGES_PROVIDED".`,
    });
  } else {
    parts.push({
      type: 'text',
      text: `Analyze the following architectural plan image(s) for project "${input.projectName ?? 'unknown'}". Extract all structural information and return valid JSON only.`,
    });

    for (const img of imagesWithData) {
      parts.push({
        type: 'image_url',
        image_url: {
          url: buildImageUrl({ mimeType: img.mimeType, base64Data: img.base64Data! }),
          detail: 'high',
        },
      });
      parts.push({
        type: 'text',
        text: `Image kind: "${img.kind}" (${img.fileName})`,
      });
    }
  }

  return { role: 'user', content: parts };
}

function parseGptResponse(raw: string): ArchitecturalImportSnapshot {
  // Strip markdown code fences if GPT returned them despite instructions.
  const cleaned = raw
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();
  return JSON.parse(cleaned) as ArchitecturalImportSnapshot;
}

function buildNoImagesSnapshot(projectName?: string): ArchitecturalImportSnapshot {
  return {
    projectMeta: { name: projectName, notes: ['No images with base64 data were provided'] },
    floors: [{ id: 'floor-1', label: 'Floor 1', elevationHintMm: null }],
    outerContour: null,
    walls: [],
    openings: [],
    stairs: [],
    roofHints: { likelyType: 'unknown', confidence: { score: 0.1, level: 'low' } },
    dimensions: [],
    unresolved: [
      {
        id: 'no-images',
        code: 'NO_IMAGES_PROVIDED',
        severity: 'blocking',
        message: 'No images with pixel data were attached to the import job.',
        requiredAction: 'Re-upload the floor plan images so the AI can process them.',
        relatedIds: [],
      },
    ],
    notes: ['openai extractor received no base64 image data'],
  };
}

export class OpenAiExtractorAdapter implements ArchitecturalExtractorAdapter {
  readonly mode = 'openai' as const;

  constructor(private readonly apiKey: string) {}

  async extractArchitecturalSnapshot(
    input: ArchitecturalExtractionInput
  ): Promise<ArchitecturalImportSnapshot> {
    const hasImages = input.sourceImages.some((img) => img.base64Data);
    if (!hasImages) {
      return buildNoImagesSnapshot(input.projectName);
    }

    const messages: OpenAiMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      buildUserMessage(input),
    ];

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: 4096,
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI returned empty response content');
    }

    try {
      const snapshot = parseGptResponse(content);
      // Ensure required fields exist with fallbacks.
      if (!Array.isArray(snapshot.unresolved)) snapshot.unresolved = [];
      if (!Array.isArray(snapshot.notes)) snapshot.notes = [];
      if (!Array.isArray(snapshot.floors) || snapshot.floors.length === 0) {
        snapshot.floors = [{ id: 'floor-1', label: 'Floor 1', elevationHintMm: null }];
      }
      if (!Array.isArray(snapshot.walls)) snapshot.walls = [];
      if (!Array.isArray(snapshot.openings)) snapshot.openings = [];
      if (!Array.isArray(snapshot.stairs)) snapshot.stairs = [];
      snapshot.notes.push(`extracted by openai/${MODEL}`);
      return snapshot;
    } catch (parseErr) {
      throw new Error(
        `Failed to parse OpenAI response as ArchitecturalImportSnapshot: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`
      );
    }
  }
}
