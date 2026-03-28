import type { ArchitecturalImportSnapshot } from '@2wix/shared-types';
import type {
  ArchitecturalExtractionInput,
  ArchitecturalExtractorAdapter,
} from './extractorAdapter.js';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o';

const SYSTEM_PROMPT = `You are an expert architectural plan analyzer specializing in SIP (Structural Insulated Panel) construction.
Analyze the provided floor plan image(s) and extract structural 2D geometry. Priority: accurate walls and outer boundary over a quick guess.

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
2. Look for dimension labels/annotations on the plan (e.g. "5287", "14600") — these are usually in mm. Use them to calibrate scale; never shrink the whole drawing to a random box without reading dimensions.
3. Use wall CENTERLINES for coordinates (midline between wall faces).
4. Place the origin (0,0) at the bottom-left corner of the outer contour bounding box of the building.
5. For walls: EVERY visible wall line must become a polyline with points at every corner and junction. Do NOT output a single long wall for the whole floor unless it is truly one straight segment. Typical houses have many segments (often 15–80+).
6. "outerContour" must follow the OUTER perimeter of the heated envelope (follow setbacks/L-shape/U-shape — NOT a loose bounding rectangle unless the building is strictly rectangular).
7. External walls: typeHint "external". Internal partitions and load-bearing interior walls: typeHint "internal".
8. SIP panel walls are typically 163mm thick (exterior) or 114mm (interior) — use as thicknessHintMm when unknown.
9. Mark doors as type "door" and windows as type "window"; link openings to the nearest wall id when possible.
10. If you cannot determine a value with confidence, set it to null and lower confidence scores.
11. "confidence.level": "high" if score >= 0.75, "medium" if >= 0.5, else "low".
12. For multi-floor plans, create separate floor entries and assign walls to their floor.
13. The "unresolved" array should list blocking issues (e.g. unreadable scale, raster too low).
14. If no scale can be determined, add an unresolved issue with code "SCALE_UNKNOWN".
15. Do NOT simplify the floor plan to a rectangle when the drawing shows rooms, corridors, or multiple wings — preserve topology.
16. Furniture, fixtures, and text are not walls — ignore them except for scale labels.`;

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
        max_tokens: 12000,
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
