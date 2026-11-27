"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { MIN_ANTE, TOPICS } from "@/lib/constants";
import { postJson } from "@/lib/client";
import { cn, formatTp } from "@/lib/format";

function localInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function CreateForm({ balance }: { balance: number }) {
  const router = useRouter();
  const [type, setType] = useState<"BINARY" | "MULTIPLE">("BINARY");
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [topic, setTopic] = useState("economics");
  const [closeAt, setCloseAt] = useState(() => localInput(new Date(Date.now() + 30 * 86_400_000)));
  const [ante, setAnte] = useState("100");
  const [probability, setProbability] = useState(50);
  const [answers, setAnswers] = useState(["", ""]);
  const [customOdds, setCustomOdds] = useState(false);
  const [odds, setOdds] = useState(["50", "50"]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const oddsSum = useMemo(() => odds.reduce((sum, value) => sum + (Number(value) || 0), 0), [odds]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        question,
        description,
        type,
        topic,
        closeAt: new Date(closeAt).toISOString(),
        ante: Number(ante),
      };
      if (type === "BINARY") payload.probability = probability / 100;
      else {
        payload.answers = answers.map((text, index) => ({
          text,
          probability: customOdds ? Number(odds[index] || 0) : undefined,
        }));
      }
      const result = await postJson<{ slug: string }>("/api/markets", payload);
      router.push(`/market/${result.slug}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the market");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="surface p-5 sm:p-6">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-pill p-1 text-sm">
        {(
          [
            ["BINARY", "Binary"],
            ["MULTIPLE", "Multiple choice"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setType(id)}
            className={cn("rounded-md py-2", type === id ? "bg-white font-medium text-ink shadow-card" : "text-secondary")}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="mt-5 block text-sm text-secondary">
        Question
        <input
          required
          data-testid="create-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Will … ?"
          className="field mt-1"
        />
      </label>
      <label className="mt-4 block text-sm text-secondary">
        Resolution criteria
        <textarea
          required
          data-testid="create-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What exactly has to happen, and which source settles it?"
          className="field mt-1 min-h-32"
        />
      </label>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-secondary">
          Topic
          <select value={topic} onChange={(event) => setTopic(event.target.value)} className="field mt-1" data-testid="create-topic">
            {TOPICS.filter((item) => item.id !== "all").map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-secondary">
          Close date
          <input
            required
            type="datetime-local"
            value={closeAt}
            onChange={(event) => setCloseAt(event.target.value)}
            className="field mt-1"
            data-testid="create-close"
          />
        </label>
      </div>

      {type === "BINARY" ? (
        <label className="mt-4 block text-sm text-secondary">
          Opening probability · <span className="num text-ink">{probability}%</span>
          <input
            type="range"
            min={1}
            max={99}
            value={probability}
            onChange={(event) => setProbability(Number(event.target.value))}
            className="mt-2 w-full"
            data-testid="create-probability"
          />
        </label>
      ) : (
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm text-secondary">
            Answers
            <button
              type="button"
              className="text-ink"
              onClick={() => {
                setAnswers((current) => [...current, ""]);
                setOdds((current) => [...current, ""]);
              }}
            >
              Add answer
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {answers.map((answer, index) => (
              <div key={index} className="flex gap-2">
                <input
                  value={answer}
                  onChange={(event) => setAnswers((current) => current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))}
                  placeholder={`Answer ${index + 1}`}
                  className="field"
                  data-testid={`create-answer-${index}`}
                />
                {customOdds && (
                  <input
                    value={odds[index] ?? ""}
                    onChange={(event) => setOdds((current) => current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))}
                    inputMode="decimal"
                    className="field num w-20"
                    aria-label={`Starting percent for answer ${index + 1}`}
                  />
                )}
                {answers.length > 2 && (
                  <button
                    type="button"
                    className="text-xs text-secondary"
                    onClick={() => {
                      setAnswers((current) => current.filter((_, itemIndex) => itemIndex !== index));
                      setOdds((current) => current.filter((_, itemIndex) => itemIndex !== index));
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-secondary">
            <input type="checkbox" checked={customOdds} onChange={(event) => setCustomOdds(event.target.checked)} />
            Set starting odds
          </label>
          {customOdds && <p className="mt-1 text-xs text-muted">Weights currently sum to {oddsSum || 0}. They are normalized to 100%.</p>}
        </div>
      )}

      <label className="mt-4 block text-sm text-secondary">
        Liquidity ante
        <span className="mt-0.5 block text-xs text-muted">
          Minimum {MIN_ANTE} TP. You have {formatTp(balance)} TP. This subsidy stays in the pool until resolution.
        </span>
        <input
          data-testid="create-ante"
          value={ante}
          onChange={(event) => setAnte(event.target.value)}
          inputMode="decimal"
          className="field num mt-1 max-w-[180px]"
        />
      </label>

      {error && <p className="mt-4 text-sm text-no">{error}</p>}
      <button type="submit" disabled={pending} data-testid="create-submit" className="btn-primary mt-5 h-11 w-full sm:w-auto sm:px-8">
        {pending ? "Creating" : "Create market"}
      </button>
    </form>
  );
}
