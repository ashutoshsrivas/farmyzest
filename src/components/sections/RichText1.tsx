// A centered heading + paragraph band. Driven by the homepage builder's
// RICH_TEXT section. Plain text only (no raw HTML) to stay safe + on-brand.
type Props = {
  heading?: string;
  body?: string;
};

export function RichText1({ heading, body }: Props) {
  if (!heading && !body) return null;
  return (
    <section className="w-full px-6 md:px-12 lg:px-20 xl:px-24 py-16 md:py-20">
      <div className="max-w-3xl mx-auto text-center">
        {heading && <h2 className="text-3xl md:text-4xl font-serif text-nate-grey-900 mb-4">{heading}</h2>}
        {body && (
          <p className="text-nate-grey-600 leading-relaxed whitespace-pre-line">{body}</p>
        )}
      </div>
    </section>
  );
}
