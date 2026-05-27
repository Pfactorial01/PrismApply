import OpenAI from "openai";

const rawModel = process.env.MODEL ?? "gpt-4o-mini";
export const tailorModel = rawModel.includes("/") ? rawModel.split("/").pop()! : rawModel;

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function callJsonLLM<T>(
  system: string,
  user: string,
  schema: {
    name: string;
    schema: Record<string, unknown>;
  },
  temperature = 0.25,
): Promise<T> {
  const res = await openai.chat.completions.create({
    model: tailorModel,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: schema.name,
        strict: true,
        schema: schema.schema,
      },
    },
    temperature,
  });
  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty LLM response");
  return JSON.parse(raw) as T;
}
