import { useState, type FormEvent } from 'react';
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AssistantContext {
  business: string;
  selectedPeriod: string;
  overview: { income: number; expenses: number; savings: number; cashFlow: number; accountActivity: number };
  months: { label: string; income: number; expenses: number; savings: number }[];
  categories: { label: string; value: number }[];
}

const suggestions = [
  'How much did I save this month?',
  'Where did I spend the most?',
  'How can I grow savings while keeping stock fresh?',
];

export function FinancialAssistant({ context }: { context: AssistantContext }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function ask(questionText: string) {
    const content = questionText.trim();
    if (!content || pending) return;
    const history = [...messages, { role: 'user' as const, content }];
    setMessages(history);
    setQuestion('');
    setError('');
    setPending(true);
    try {
      const base = import.meta.env.VITE_ASSISTANT_API_BASE ?? 'http://localhost:4000';
      const response = await fetch(`${base}/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(45_000),
        body: JSON.stringify({
          messages: history.slice(-12),
          context: {
            ...context,
            months: context.months.slice(-12),
            categories: context.categories.slice(0, 12),
          },
        }),
      });
      const result = await response.json() as { answer?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? 'The assistant could not answer. Please try again.');
      if (!result.answer?.trim()) throw new Error('The assistant returned an empty response. Please try again.');
      setMessages((current) => [...current, { role: 'assistant', content: result.answer!.trim() }]);
    } catch (cause) {
      setMessages((current) => current.length && current[current.length - 1].role === 'user' ? current.slice(0, -1) : current);
      setQuestion(content);
      setError(cause instanceof Error && cause.name === 'TimeoutError'
        ? 'That took too long. Please try again.'
        : cause instanceof Error ? cause.message : 'The assistant is unavailable. Please try again.');
    } finally {
      setPending(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  return (
    <section className="assistant-live" aria-labelledby="assistant-title">
      <header className="assistant-live-head">
        <div><span className="section-label">FINBRIDGE AI</span><h2 id="assistant-title">Ask about your finances</h2><p>Answers use the demo figures shown on this dashboard.</p></div>
        <span className="assistant-status"><i />Server-side AI</span>
      </header>
      <div className="assistant-conversation" aria-live="polite" aria-relevant="additions text">
        {!messages.length && <div className="assistant-intro"><b>What would you like to understand?</b><span>Try a question, or start with one of these:</span><div className="assistant-suggestions">{suggestions.map((suggestion) => <button key={suggestion} type="button" disabled={pending} onClick={() => void ask(suggestion)}>{suggestion}</button>)}</div></div>}
        {messages.map((message, index) => <div className={`assistant-message ${message.role}`} key={`${message.role}-${index}`}><span>{message.role === 'user' ? 'You' : 'FinBridge AI'}</span><p>{message.content}</p></div>)}
        {pending && <div className="assistant-message assistant" role="status"><span>FinBridge AI</span><p className="assistant-thinking">Thinking through your numbers…</p></div>}
      </div>
      {error && <p className="assistant-error" role="alert">{error}</p>}
      <form className="assistant-compose" onSubmit={submit}><label className="sr-only" htmlFor="financial-question">Ask FinBridge about your finances</label><textarea id="financial-question" rows={2} maxLength={2000} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about your income, spending or savings…" disabled={pending} /><button className="btn btn-primary" type="submit" disabled={pending || !question.trim()} aria-label="Send question">{pending ? 'Thinking…' : 'Ask'}</button></form>
      <p className="assistant-disclaimer">Demo financial figures only. This assistant does not provide credit decisions or access real bank credentials.</p>
    </section>
  );
}
