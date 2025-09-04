// components/seo/JsonLd.tsx
// Server component by default (no "use client")
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // Safe stringify (no indentation) to keep payload small
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
