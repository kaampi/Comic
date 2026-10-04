import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ComicProject } from "./project";
import type { Locale } from "./settings";
import type { LocalAiSettings } from "./localAi";
import type { AdaptationBeat, BeatType, PanelPlan } from "./adaptation/types";
import { suggestAiBeats } from "./adaptation/aiBeats";
import {
  activeManuscriptAdaptation,
  addManualBeat,
  addBeatPanel,
  appendAiBeats,
  editManuscript,
  generateBeatPanelPrompt,
  patchBeatPanel,
  patchManuscriptBeat,
  withAdaptation,
  type TextRange,
} from "./manuscriptModel";
import { manuscriptText } from "./manuscriptText";
import "./manuscript.css";
const beatTypes: BeatType[] = [
  "establishing",
  "introduction",
  "action",
  "dialogue",
  "reaction",
  "transition",
  "atmosphere",
  "climax",
  "resolution",
];
export function ManuscriptWorkspace({
  project,
  locale,
  settings,
  onUpdate,
  onSettings,
}: {
  project: ComicProject;
  locale: Locale;
  settings: LocalAiSettings;
  onUpdate: (update: (project: ComicProject) => ComicProject) => void;
  onSettings: () => void;
}) {
  const t = manuscriptText(locale),
    source = project.source.textSnapshot ?? "",
    adaptation = activeManuscriptAdaptation(project);
  const [selected, setSelected] = useState<string | null>(
      adaptation.beats[0]?.id ?? null,
    ),
    [range, setRange] = useState<TextRange | null>(null),
    [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [width, setWidth] = useState(
    () =>
      Number(localStorage.getItem("comicbook-ai.manuscript-sidebar-width")) ||
      420,
  );
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [progress, setProgress] = useState(""),
    [draft, setDraft] = useState<{
      source: string;
      beats: AdaptationBeat[];
    } | null>(null),
    [excluded, setExcluded] = useState<string[]>([]);
  const editor = useRef<HTMLDivElement>(null),
    caret = useRef<TextRange | null>(null),
    abort = useRef<AbortController | null>(null),
    request = useRef(0);
  useEffect(() => {
    request.current++;
    abort.current?.abort();
    setBusy(false);
    setRange(null);
    return () => {
      request.current++;
      abort.current?.abort();
    };
  }, [source]);
  useEffect(() => {
    try {
      localStorage.setItem(
        "comicbook-ai.manuscript-sidebar-width",
        String(width),
      );
    } catch {}
  }, [width]);
  const readRange = (): TextRange | null => {
    const s = window.getSelection(),
      root = editor.current;
    if (!s?.rangeCount || !root) return null;
    const r = s.getRangeAt(0);
    if (!root.contains(r.startContainer) || !root.contains(r.endContainer))
      return null;
    const prefix = r.cloneRange();
    prefix.selectNodeContents(root);
    prefix.setEnd(r.startContainer, r.startOffset);
    const start = prefix.toString().length;
    return { start, end: start + r.toString().length };
  };
  useLayoutEffect(() => {
    if (!caret.current || !editor.current) return;
    const desired = caret.current;
    caret.current = null;
    const walker = document.createTreeWalker(
      editor.current,
      NodeFilter.SHOW_TEXT,
    );
    const r = document.createRange();
    let node: Node | null,
      total = 0,
      startDone = false;
    while ((node = walker.nextNode())) {
      const length = node.textContent?.length ?? 0;
      if (!startDone && desired.start <= total + length) {
        r.setStart(node, Math.max(0, desired.start - total));
        startDone = true;
      }
      if (startDone && desired.end <= total + length) {
        r.setEnd(node, Math.max(0, desired.end - total));
        const s = window.getSelection();
        s?.removeAllRanges();
        s?.addRange(r);
        break;
      }
      total += length;
    }
  }, [source, selected]);
  const capture = () => {
    const next = readRange();
    setRange(next && next.end > next.start ? next : null);
  };
  const choose = (id: string) => {
    setSelected(id);
    editor.current
      ?.querySelector(`[data-beat-ids~="${id}"]`)
      ?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  };
  const create = () => {
    if (!range) return;
    onUpdate((p) => {
      const result = addManualBeat(p, range);
      setSelected(result.beatId);
      return result.project;
    });
    setMenu(null);
  };
  const analyse = async () => {
    setMenu(null);
    if (!range) return;
    if (!settings.servers[settings.engine].model.trim()) {
      setMessage(t.noModel);
      return;
    }
    const scope = { ...range },
      snapshot = source;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const token = ++request.current;
    setBusy(true);
    setProgress("");
    setMessage("");
    setDraft(null);
    setExcluded([]);
    let timedOut = false;
    const timeout = () => {
      timedOut = true;
      controller.abort();
    };
    let timer = window.setTimeout(timeout, 300000);
    try {
      const beats = await suggestAiBeats({
        source: snapshot.slice(scope.start, scope.end),
        sourceOffset: scope.start,
        context: {
          characters: project.characters,
          locations: project.locations,
        },
        settings,
        signal: controller.signal,
        onProgress: (done, total) => {
          if (token !== request.current) return;
          setProgress(`${Math.min(done + 1, total)} / ${total}`);
          window.clearTimeout(timer);
          timer = window.setTimeout(timeout, 300000);
        },
      });
      if (token === request.current && !controller.signal.aborted)
        setDraft({ source: snapshot, beats });
    } catch (error) {
      if (token === request.current)
        setMessage(
          controller.signal.aborted
            ? timedOut
              ? t.timeout
              : t.cancelled
            : t.failed +
                " " +
                (error instanceof Error ? error.message : String(error)),
        );
    } finally {
      window.clearTimeout(timer);
      if (token === request.current) setBusy(false);
    }
  };
  const beat = adaptation.beats.find((b) => b.id === selected),
    index = adaptation.beats.findIndex((b) => b.id === selected);
  const patch = (change: Partial<AdaptationBeat>) => {
    if (beat) onUpdate((p) => patchManuscriptBeat(p, beat.id, change));
  };
  const boundaries = [
    ...new Set([
      0,
      source.length,
      ...adaptation.beats.flatMap((b) =>
        b.sourceStart === undefined || b.sourceEnd === undefined
          ? []
          : [b.sourceStart, b.sourceEnd],
      ),
    ]),
  ].sort((a, b) => a - b);
  const escapeHtml = (text: string) =>
    text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/\r/g, "&#13;");
  const markedSource = boundaries
    .slice(0, -1)
    .map((start, i) => {
      const end = boundaries[i + 1],
        beats = adaptation.beats.filter(
          (b) =>
            b.sourceStart !== undefined &&
            b.sourceEnd !== undefined &&
            b.sourceStart <= start &&
            b.sourceEnd >= end,
        ),
        active = beats.some((b) => b.id === selected);
      return `<span${beats.length ? ` data-beat-ids="${escapeHtml(beats.map((b) => b.id).join(" "))}" class="manuscript-beat${active ? " is-selected" : ""}${beats.some((b) => b.sourceNeedsReview) ? " needs-review" : ""}"` : ""}>${escapeHtml(source.slice(start, end))}</span>`;
    })
    .join("");
  const editPrompt = (plan: PanelPlan, value: string) =>
    onUpdate((p) => {
      const a = activeManuscriptAdaptation(p),
        previous = a.imagePrompts.find((x) => x.panelId === plan.id),
        now = new Date().toISOString(),
        prompt = {
          ...previous,
          id: previous?.id ?? crypto.randomUUID(),
          panelId: plan.id,
          mode: previous?.mode ?? ("full" as const),
          prompt: value,
          createdAt: previous?.createdAt ?? now,
          updatedAt: now,
        };
      return withAdaptation(p, {
        ...a,
        imagePrompts: [
          ...a.imagePrompts.filter((x) => x.panelId !== plan.id),
          prompt,
        ],
        panelPlans: a.panelPlans.map((x) =>
          x.id === plan.id ? { ...x, imagePromptId: prompt.id } : x,
        ),
      });
    });
  const loadImage = (planId: string, file: File) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setMessage(t.readError);
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setMessage(t.readError);
    reader.onload = () => {
      if (typeof reader.result === "string")
        onUpdate((p) =>
          patchBeatPanel(p, planId, {
            image: { name: file.name, dataUrl: reader.result as string },
          }),
        );
    };
    reader.readAsDataURL(file);
  };
  const insertText = (text: string) => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editor.current) return;
    const target = selection.getRangeAt(0);
    if (!editor.current.contains(target.commonAncestorContainer)) return;
    target.deleteContents();
    const node = document.createTextNode(text);
    target.insertNode(node);
    target.setStartAfter(node);
    target.collapse(true);
    selection.removeAllRanges();
    selection.addRange(target);
    caret.current = readRange();
    const value = editor.current.textContent ?? "";
    onUpdate((p) => editManuscript(p, value));
  };
  return (
    <section
      className="manuscript-studio"
      style={
        {
          "--beat-sidebar": `${Math.max(320, Math.min(700, width))}px`,
        } as React.CSSProperties
      }
    >
      <div className="manuscript-document">
        <div className="section-heading">
          <h2>{t.zoom}</h2>
          <span>
            {adaptation.beats.length} {t.count}
          </span>
        </div>
        <p className="quiet">{t.hint}</p>
        <div className="manuscript-toolbar">
          <button
            type="button"
            className="primary-button"
            disabled={!range}
            onMouseDown={(e) => e.preventDefault()}
            onClick={create}
          >
            {t.create}
          </button>
          <button
            type="button"
            className="text-button"
            disabled={!range || busy}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void analyse()}
          >
            {t.ai}
          </button>
          {range ? (
            <small>
              {t.mark}: {range.end - range.start} {t.chars}
            </small>
          ) : null}
        </div>
        <div
          ref={editor}
          role="textbox"
          aria-label="Manus"
          aria-multiline="true"
          className="manuscript-source"
          contentEditable
          suppressContentEditableWarning
          onMouseUp={capture}
          onKeyUp={capture}
          onInput={(e) => {
            caret.current = readRange();
            const value = e.currentTarget.textContent ?? "";
            onUpdate((p) => editManuscript(p, value));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              insertText("\n");
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            insertText(e.clipboardData.getData("text/plain"));
          }}
          onClick={(e) => {
            const currentRange = readRange();
            if (currentRange && currentRange.end > currentRange.start) return;
            caret.current = currentRange;
            const node = (e.target as HTMLElement).closest<HTMLElement>(
              "[data-beat-ids]",
            );
            if (node?.dataset.beatIds)
              setSelected(node.dataset.beatIds.split(" ")[0]);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            capture();
            setMenu({
              x: Math.max(8, Math.min(e.clientX, window.innerWidth - 280)),
              y: Math.max(8, Math.min(e.clientY, window.innerHeight - 130)),
            });
          }}
          dangerouslySetInnerHTML={{ __html: markedSource }}
        />
      </div>
      <div
        className="beat-resizer"
        role="separator"
        aria-label={t.resize}
        aria-orientation="vertical"
        aria-valuemin={320}
        aria-valuemax={700}
        aria-valuenow={width}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            setWidth((w) =>
              Math.max(
                320,
                Math.min(700, w + (e.key === "ArrowLeft" ? 20 : -20)),
              ),
            );
          }
        }}
        onPointerDown={(e) => {
          const initial = e.clientX,
            original = width;
          const move = (event: PointerEvent) =>
            setWidth(
              Math.max(320, Math.min(700, original + initial - event.clientX)),
            );
          const end = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", end);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", end);
        }}
      />
      <aside className="beat-inspector">
        {busy ? (
          <div role="status">
            {t.analysing} {progress}
            <button
              type="button"
              className="text-button"
              onClick={() => {
                abort.current?.abort();
                setBusy(false);
              }}
            >
              {t.cancel}
            </button>
          </div>
        ) : null}
        {message ? (
          <p role="alert">
            {message}
            <button type="button" className="text-button" onClick={onSettings}>
              {t.settings}
            </button>
          </p>
        ) : null}
        {draft ? (
          <section className="beat-ai-review">
            <h3>{t.aiReview}</h3>
            {draft.source !== source ? <p role="alert">{t.stale}</p> : null}
            {draft.beats.map((b) => (
              <article key={b.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={!excluded.includes(b.id)}
                    onChange={(e) =>
                      setExcluded((ids) =>
                        e.target.checked
                          ? ids.filter((id) => id !== b.id)
                          : [...ids, b.id],
                      )
                    }
                  />
                  {t.include}
                </label>
                <input
                  aria-label={t.title}
                  value={b.title}
                  onChange={(e) =>
                    setDraft((d) =>
                      d
                        ? {
                            ...d,
                            beats: d.beats.map((x) =>
                              x.id === b.id
                                ? { ...x, title: e.target.value }
                                : x,
                            ),
                          }
                        : d,
                    )
                  }
                />
                <textarea
                  aria-label={t.summary}
                  value={b.summary}
                  onChange={(e) =>
                    setDraft((d) =>
                      d
                        ? {
                            ...d,
                            beats: d.beats.map((x) =>
                              x.id === b.id
                                ? {
                                    ...x,
                                    summary: e.target.value,
                                    visualCandidates: x.visualCandidates.map(
                                      (v) =>
                                        v.description === x.summary
                                          ? {
                                              ...v,
                                              description: e.target.value,
                                            }
                                          : v,
                                    ),
                                  }
                                : x,
                            ),
                          }
                        : d,
                    )
                  }
                />
                <blockquote>{b.sourceTextExcerpt}</blockquote>
              </article>
            ))}
            <button
              type="button"
              className="primary-button"
              disabled={
                draft.source !== source ||
                draft.beats.every((b) => excluded.includes(b.id))
              }
              onClick={() => {
                const proposals = draft.beats.filter(
                  (b) => !excluded.includes(b.id),
                );
                onUpdate((p) => appendAiBeats(p, proposals));
                setSelected(proposals[0]?.id ?? selected);
                setDraft(null);
              }}
            >
              {t.apply}
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => setDraft(null)}
            >
              {t.discard}
            </button>
          </section>
        ) : null}
        {beat ? (
          <>
            <div className="beat-navigation">
              <button
                type="button"
                aria-label={t.previous}
                disabled={index <= 0}
                onClick={() => choose(adaptation.beats[index - 1].id)}
              >
                ←
              </button>
              <strong>
                {t.beat} {index + 1} {t.of} {adaptation.beats.length}
              </strong>
              <button
                type="button"
                aria-label={t.next}
                disabled={index >= adaptation.beats.length - 1}
                onClick={() => choose(adaptation.beats[index + 1].id)}
              >
                →
              </button>
            </div>
            <label>
              {t.title}
              <input
                value={beat.title}
                onChange={(e) => patch({ title: e.target.value })}
              />
            </label>
            <details className="beat-section" key={beat.id + "-summary"}>
              <summary>{t.summary}</summary>
              <div className="beat-section-body">
                <label>
                  {t.summary}
                  <textarea
                    rows={3}
                    value={beat.summary}
                    onChange={(e) => patch({ summary: e.target.value })}
                  />
                </label>
              </div>
            </details>
            <details className="beat-section" key={beat.id + "-type"}>
              <summary>{t.type}</summary>
              <div className="beat-section-body">
                <label>
                  {t.type}
                  <select
                    value={beat.beatType}
                    onChange={(e) =>
                      patch({ beatType: e.target.value as BeatType })
                    }
                  >
                    {beatTypes.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </label>
              </div>
            </details>
            <details className="beat-section" key={beat.id + "-characters"}>
              <summary>{t.characters}</summary>
              <div className="beat-section-body">
                <fieldset>
                  <legend>{t.characters}</legend>
                  {project.characters.map((c) => (
                    <label key={c.id}>
                      <input
                        type="checkbox"
                        checked={beat.characterIds.includes(c.id)}
                        onChange={(e) =>
                          patch({
                            characterIds: e.target.checked
                              ? [...beat.characterIds, c.id]
                              : beat.characterIds.filter((id) => id !== c.id),
                          })
                        }
                      />
                      {c.name}
                    </label>
                  ))}
                </fieldset>
              </div>
            </details>
            <details className="beat-section" key={beat.id + "-location"}>
              <summary>{t.location}</summary>
              <div className="beat-section-body">
                <label>
                  {t.location}
                  <select
                    value={beat.locationId ?? ""}
                    onChange={(e) =>
                      patch({ locationId: e.target.value || undefined })
                    }
                  >
                    <option value="">{t.none}</option>
                    {project.locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </details>
            <details className="beat-section" key={beat.id + "-dialogue"}>
              <summary>{t.dialogue}</summary>
              <div className="beat-section-body">
                {beat.dialogueCandidates.map((item, i) => (
                  <label key={item.id}>
                    {t.dialogue}
                    <textarea
                      value={item.text}
                      onChange={(e) =>
                        patch({
                          dialogueCandidates: beat.dialogueCandidates.map(
                            (x, n) =>
                              n === i
                                ? {
                                    ...x,
                                    text: e.target.value,
                                    source: "adapted",
                                  }
                                : x,
                          ),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            </details>
            <details className="beat-section" key={beat.id + "-narration"}>
              <summary>{t.narration}</summary>
              <div className="beat-section-body">
                {beat.captionCandidates.map((item, i) => (
                  <label key={item.id}>
                    {t.narration}
                    <textarea
                      value={item.text}
                      onChange={(e) =>
                        patch({
                          captionCandidates: beat.captionCandidates.map(
                            (x, n) =>
                              n === i
                                ? {
                                    ...x,
                                    text: e.target.value,
                                    source: "adapted",
                                  }
                                : x,
                          ),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            </details>{" "}
            <details>
              <summary>{t.source}</summary>
              <blockquote>{beat.sourceTextExcerpt}</blockquote>
            </details>
            {beat.sourceNeedsReview ? (
              <div className="beat-review-warning">
                <p>
                  {beat.sourceStart === undefined ||
                  beat.sourceEnd === beat.sourceStart
                    ? t.missing
                    : t.review}
                </p>
                {beat.sourceStart !== undefined &&
                beat.sourceEnd !== beat.sourceStart ? (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      patch({
                        sourceTextExcerpt: source.slice(
                          beat.sourceStart,
                          beat.sourceEnd,
                        ),
                        sourceNeedsReview: false,
                        status: "approved",
                      })
                    }
                  >
                    {t.reviewed}
                  </button>
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              className="text-button"
              disabled={!range}
              onClick={() => {
                if (range)
                  patch({
                    sourceStart: range.start,
                    sourceEnd: range.end,
                    sourceTextExcerpt: source.slice(range.start, range.end),
                    sourceNeedsReview: false,
                  });
              }}
            >
              {t.relink}
            </button>
            <details
              className="beat-panels-section beat-section"
              open
              key={beat.id + "-panels"}
            >
              <summary>
                {t.panels}
                <span className="beat-section-count">
                  {
                    adaptation.panelPlans.filter((plan) =>
                      plan.sourceBeatIds.includes(beat.id),
                    ).length
                  }
                </span>
              </summary>
              <div className="section-heading">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => onUpdate((p) => addBeatPanel(p, beat.id))}
                >
                  {t.addPanel}
                </button>
              </div>
              {adaptation.panelPlans
                .filter((plan) => plan.sourceBeatIds.includes(beat.id))
                .map((plan) => {
                  const prompt = adaptation.imagePrompts.find(
                    (x) => x.panelId === plan.id,
                  );
                  const update = (patch: Partial<PanelPlan>) =>
                    onUpdate((p) => patchBeatPanel(p, plan.id, patch));
                  const projectedId = project.panels.find(
                    (p) => p.adaptationPanelPlanId === plan.id,
                  )?.id;
                  const image =
                    plan.image ??
                    project.pages
                      .flatMap((p) => p.placements)
                      .find(
                        (p) =>
                          p.adaptationPanelPlanId === plan.id ||
                          (projectedId && p.panelId === projectedId),
                      )?.image;
                  return (
                    <details className="beat-panel-card" key={plan.id}>
                      <summary>
                        <span>
                          {plan.order} · {plan.title}
                        </span>
                        {plan.sourceNeedsReview ? (
                          <span aria-label={t.dirtyPanel}> ⚠</span>
                        ) : null}
                      </summary>
                      <div className="beat-panel-body">
                        {plan.sourceNeedsReview ? (
                          <div className="beat-review-warning">
                            <p>{t.dirtyPanel}</p>
                            <button
                              type="button"
                              className="text-button"
                              onClick={() =>
                                update({ sourceNeedsReview: false })
                              }
                            >
                              {t.reviewed}
                            </button>
                          </div>
                        ) : null}
                        <label>
                          {t.direction}
                          <textarea
                            rows={3}
                            value={plan.visualDescription}
                            onChange={(e) =>
                              update({ visualDescription: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          {t.shot}
                          <select
                            value={plan.shotType ?? "medium"}
                            onChange={(e) =>
                              update({
                                shotType: e.target
                                  .value as PanelPlan["shotType"],
                              })
                            }
                          >
                            {[
                              "wide",
                              "establishing-wide",
                              "medium",
                              "medium-close",
                              "close-up",
                              "extreme-close-up",
                              "over-shoulder",
                              "reaction",
                              "insert",
                            ].map((x) => (
                              <option key={x}>{x}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          {t.size}
                          <select
                            value={plan.sizeHint ?? "medium"}
                            onChange={(e) =>
                              update({
                                sizeHint: e.target
                                  .value as PanelPlan["sizeHint"],
                              })
                            }
                          >
                            {[
                              "small",
                              "medium",
                              "large",
                              "full-width",
                              "splash",
                            ].map((x) => (
                              <option key={x}>{x}</option>
                            ))}
                          </select>
                        </label>
                        {plan.dialogue.map((item) => (
                          <label key={item.id}>
                            {t.dialogue}
                            <textarea
                              value={item.text}
                              onChange={(e) =>
                                update({
                                  dialogue: plan.dialogue.map((x) =>
                                    x.id === item.id
                                      ? {
                                          ...x,
                                          text: e.target.value,
                                          source: "adapted",
                                        }
                                      : x,
                                  ),
                                })
                              }
                            />
                          </label>
                        ))}
                        {plan.captions.map((item) => (
                          <label key={item.id}>
                            {t.narration}
                            <textarea
                              value={item.text}
                              onChange={(e) =>
                                update({
                                  captions: plan.captions.map((x) =>
                                    x.id === item.id
                                      ? {
                                          ...x,
                                          text: e.target.value,
                                          source: "adapted",
                                        }
                                      : x,
                                  ),
                                })
                              }
                            />
                          </label>
                        ))}
                        <div className="beat-text-actions">
                          <button
                            type="button"
                            className="text-button"
                            onClick={() =>
                              update({
                                dialogue: [
                                  ...plan.dialogue,
                                  {
                                    id: crypto.randomUUID(),
                                    text: "",
                                    source: "adapted",
                                    bubbleType: "speech",
                                  },
                                ],
                              })
                            }
                          >
                            {t.addDialogue}
                          </button>
                          <button
                            type="button"
                            className="text-button"
                            onClick={() =>
                              update({
                                captions: [
                                  ...plan.captions,
                                  {
                                    id: crypto.randomUUID(),
                                    text: "",
                                    source: "adapted",
                                    style: "narration",
                                  },
                                ],
                              })
                            }
                          >
                            {t.addNarration}
                          </button>
                        </div>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() =>
                            onUpdate((p) => generateBeatPanelPrompt(p, plan.id))
                          }
                        >
                          {t.generate}
                        </button>
                        {prompt ? (
                          <>
                            <label>
                              {t.prompt}
                              <textarea
                                rows={6}
                                value={prompt.prompt}
                                onChange={(e) =>
                                  editPrompt(plan, e.target.value)
                                }
                              />
                            </label>
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => {
                                void navigator.clipboard
                                  .writeText(prompt.prompt)
                                  .then(
                                    () => setMessage(t.copied),
                                    () => setMessage(t.failed),
                                  );
                              }}
                            >
                              {t.copy}
                            </button>
                          </>
                        ) : null}
                        <label
                          className="beat-image-drop"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (e.dataTransfer.files[0])
                              loadImage(plan.id, e.dataTransfer.files[0]);
                          }}
                        >
                          {image ? (
                            <img src={image.dataUrl} alt={image.name} />
                          ) : (
                            <span>{t.drop}</span>
                          )}
                          <span>{image ? t.changeImage : t.image}</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={(e) => {
                              if (e.target.files?.[0])
                                loadImage(plan.id, e.target.files[0]);
                              e.currentTarget.value = "";
                            }}
                          />
                        </label>
                        {plan.image ? (
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => update({ image: undefined })}
                          >
                            {t.removeImage}
                          </button>
                        ) : null}
                        {plan.imageVersions?.length ? (
                          <details className="beat-image-history">
                            <summary>{t.imageHistory}</summary>
                            {plan.imageVersions.map((previous, index) => (
                              <button
                                type="button"
                                className="text-button"
                                key={index}
                                onClick={() => update({ image: previous })}
                              >
                                <img src={previous.dataUrl} alt="" />
                                {previous.name} · {t.restore}
                              </button>
                            ))}
                          </details>
                        ) : null}
                      </div>
                    </details>
                  );
                })}
            </details>
          </>
        ) : (
          <p>{t.select}</p>
        )}
        <details className="manuscript-beat-list" open>
          <summary>{t.beatList}</summary>
          {adaptation.beats.map((b) => (
            <button
              type="button"
              className={selected === b.id ? "is-active" : ""}
              key={b.id}
              onClick={() => choose(b.id)}
            >
              {b.order} · {b.title}
              {b.sourceNeedsReview ? " ⚠" : ""}
            </button>
          ))}
        </details>
      </aside>
      {menu ? (
        <>
          <div className="beat-menu-dismiss" onClick={() => setMenu(null)} />
          <div
            className="beat-context-menu"
            role="menu"
            onKeyDown={(e) => {
              if (e.key === "Escape") setMenu(null);
            }}
            style={{ left: menu.x, top: menu.y }}
          >
            <button
              type="button"
              role="menuitem"
              disabled={!range}
              onClick={create}
            >
              {t.create}
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={!range || busy}
              onClick={() => void analyse()}
            >
              {t.ai}
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
