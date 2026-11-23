import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  slugify,
  uniqueSlug,
  scriptToTimeline,
  shotsFromBeats,
  createProject,
  getProject,
  listProjects,
  saveShots,
  saveRefs,
  refImagePath,
  saveRefImage,
  sceneStub,
  generateScenes,
  videoFilePath,
} from "../../packages/pipeline/index";
import { buildShotRefPrompt, STYLE_IDS } from "../../packages/pipeline/prompts";
import { refImageName, boardFramesForShot } from "../../packages/pipeline/engine-sd";

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "shortcraft-test-"));
  process.env.SHORTCRAFT_PROJECTS_DIR = tmp;
});
afterEach(() => {
  delete process.env.SHORTCRAFT_PROJECTS_DIR;
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("slug guard", () => {
  it("slugifies titles with accents and punctuation", () => {
    expect(slugify("Why Réaction Time Matters!")).toBe("why-reaction-time-matters");
    expect(slugify("  ---  ")).toBe("video");
  });
  it("adds a counter when a slug already exists", () => {
    fs.mkdirSync(path.join(tmp, "my-video"));
    expect(uniqueSlug("My Video")).toBe("my-video-2");
    fs.mkdirSync(path.join(tmp, "my-video-2"));
    expect(uniqueSlug("My Video")).toBe("my-video-3");
  });
});

describe("script -> timeline -> shots", () => {
  it("splits sentences into words and contiguous beats", () => {
    const t = scriptToTimeline("Hello world. This is a test!");
    expect(t.words.length).toBeGreaterThan(4);
    expect(t.beats.length).toBe(2);
    for (let i = 1; i < t.beats.length; i++) {
      expect(t.beats[i].start).toBeCloseTo(t.beats[i - 1].end, 2);
    }
  });
  it("builds one shot per beat with s001 ids", () => {
    const t = scriptToTimeline("One. Two. Three.");
    const shots = shotsFromBeats(t.beats);
    expect(shots.map((s) => s.id)).toEqual(["s001", "s002", "s003"]);
    expect(shots[0].scene).toContain("TODO");
  });
});

describe("project lifecycle", () => {
  it("creates a project with the full JSON tree and reads it back identically", () => {
    const p = createProject("Test Film", { script: "A cat sat. The dog ran." });
    expect(p.slug).toBe("test-film");
    expect(p.shots.length).toBe(2);
    expect(fs.existsSync(path.join(tmp, "test-film", "config.json"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, "test-film", "timeline", "words.json"))).toBe(true);
    const again = getProject("test-film");
    expect(again?.shots.length).toBe(2);
    expect(again?.config.title).toBe("Test Film");
    expect(again?.duration).toBe(p.duration);
  });
  it("saves and reloads shots and refs without shape drift", () => {
    createProject("Shapes", { script: "First. Second." });
    const shots = shotsFromBeats(scriptToTimeline("First. Second. Third.").beats);
    saveShots("shapes", shots);
    expect(getProject("shapes")?.shots.length).toBe(3);
    saveRefs("shapes", []);
    expect(getProject("shapes")?.refs).toEqual([]);
  });
  it("lists projects", () => {
    createProject("A", { script: "Text." });
    createProject("B", { script: "Text." });
    expect(listProjects().length).toBe(2);
  });
  it("rejects path traversal in slugs", () => {
    expect(getProject("../etc")).toBeNull();
  });
});

describe("ref image persistence", () => {
  it("blocks traversal in filenames", () => {
    expect(refImagePath("proj", "../evil.png")).toBeNull();
    expect(refImagePath("proj", "evil.jpg")).toBeNull();
    expect(refImagePath("proj", "ok.png")).toContain("ok.png");
  });
  it("writes bytes to the project ref folder", () => {
    const dest = saveRefImage("proj", "s001_x.png", new Uint8Array([1, 2, 3]));
    expect(dest).toBe(true);
    expect(fs.readFileSync(path.join(tmp, "proj", "ref", "s001_x.png"))).toEqual(Buffer.from([1, 2, 3]));
  });
  it("builds ref filenames and board frames", () => {
    const ref = { shotId: "s001", id: "s001-12345678" } as any;
    expect(refImageName(ref)).toBe("s001_12345678.png");
    const project = {
      refs: [{ shotId: "s001", stage: "approved", status: "done", image: "x.png", promptPreview: "hi", prompt: "hi" }],
    } as any;
    expect(boardFramesForShot(project, "s001", 1.5)[0].image).toBe("x.png");
  });
});

describe("prompts", () => {
  it("produces a style-prefixed prompt with aspect-aware composition", () => {
    const shot = { id: "s001", line: "A fly buzzes.", scene: "A fly past a face", set: "cafe", bars: null, in: {}, notes: "" } as any;
    const wide = buildShotRefPrompt(shot, { aspect: "16:9", resolution: "1080p", style: "emerald", fps: 24, engine: "evolution" });
    const vertical = buildShotRefPrompt(shot, { aspect: "9:16", resolution: "1080p", style: "ember", fps: 24, engine: "evolution" });
    expect(wide.prompt).toContain("wide shot");
    expect(vertical.prompt).toContain("9:16");
    expect(vertical.prompt).toContain("left third");
    expect(vertical.prompt).toContain("charcoal and crimson");
    expect(wide.negative).toContain("watermark");
    expect(STYLE_IDS).toContain("sakura");
  });
});

describe("scenes", () => {
  it("generates one registerShot stub per shot", () => {
    createProject("Scenes", { script: "One. Two." });
    const n = generateScenes("scenes");
    expect(n).toBe(2);
    const files = fs.readdirSync(path.join(tmp, "scenes", "scenes", "shots")).filter((f) => f.endsWith(".js"));
    expect(files.length).toBe(2);
    const stub = sceneStub({ id: "s001", scene: "Hello", line: "Hi" } as any, {} as any);
    expect(stub).toContain('registerShot("s001"');
    expect(stub).toContain("Hello");
  });
  it("reports no video when nothing is rendered", () => {
    createProject("NoVideo", { script: "Text." });
    expect(videoFilePath("no-video")).toBeNull();
  });
});
