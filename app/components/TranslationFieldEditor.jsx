import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

const HTML_FIELDS = ["body_html", "content", "body"];

const FIELD_LABELS = {
  title: "Title",
  body_html: "Description (HTML)",
  meta_title: "SEO Title",
  meta_description: "SEO Description",
};

function TipTapEditor({ value, onChange }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || "",
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Sync external value changes (e.g. language switch)
  useEffect(() => {
    if (editor && editor.getHTML() !== (value || "")) {
      editor.commands.setContent(value || "", false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div
      style={{
        border: "1px solid #c9cccf",
        borderRadius: "0.5rem",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          background: "#f6f6f7",
          borderBottom: "1px solid #c9cccf",
          padding: "4px 8px",
          display: "flex",
          gap: "4px",
          flexWrap: "wrap",
        }}
      >
        {[
          { label: "B", action: () => editor?.chain().focus().toggleBold().run(), active: editor?.isActive("bold") },
          { label: "I", action: () => editor?.chain().focus().toggleItalic().run(), active: editor?.isActive("italic") },
          { label: "• List", action: () => editor?.chain().focus().toggleBulletList().run(), active: editor?.isActive("bulletList") },
          { label: "1. List", action: () => editor?.chain().focus().toggleOrderedList().run(), active: editor?.isActive("orderedList") },
        ].map(({ label, action, active }) => (
          <button
            key={label}
            type="button"
            onClick={action}
            style={{
              padding: "2px 8px",
              fontSize: "12px",
              borderRadius: "4px",
              border: "1px solid #c9cccf",
              background: active ? "#e3e5e8" : "#fff",
              cursor: "pointer",
              fontWeight: label === "B" ? 700 : label === "I" ? "italic" : 400,
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ padding: "8px", minHeight: "100px", background: "#fff" }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export function TranslationFieldEditor({ fieldKey, originalValue, translatedValue, onChange }) {
  const label = FIELD_LABELS[fieldKey] || fieldKey;
  const isHtml = HTML_FIELDS.includes(fieldKey);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "14px", fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: "12px", color: "#8c9196" }}>{fieldKey}</span>
      </div>

      {/* Original value (read-only reference) */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <span style={{ fontSize: "12px", color: "#8c9196" }}>Original</span>
        {isHtml ? (
          <div
            style={{
              padding: "8px",
              background: "#f6f6f7",
              border: "1px solid #e1e3e5",
              borderRadius: "6px",
              fontSize: "13px",
              color: "#616161",
              maxHeight: "80px",
              overflow: "auto",
            }}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: originalValue || "<em>No content</em>" }}
          />
        ) : (
          <textarea
            value={originalValue || ""}
            readOnly
            rows={fieldKey === "meta_description" ? 2 : 1}
            style={{
              width: "100%",
              padding: "8px",
              border: "1px solid #e1e3e5",
              borderRadius: "6px",
              fontSize: "13px",
              background: "#f6f6f7",
              color: "#616161",
              resize: "none",
              boxSizing: "border-box",
            }}
          />
        )}
      </div>

      {/* Translation input */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <span style={{ fontSize: "12px", color: "#8c9196" }}>Translation</span>
        {isHtml ? (
          <TipTapEditor value={translatedValue} onChange={onChange} />
        ) : (
          <textarea
            value={translatedValue || ""}
            onChange={(e) => onChange(e.target.value)}
            rows={fieldKey === "meta_description" ? 3 : 1}
            placeholder={`Translate: ${originalValue || ""}`}
            style={{
              width: "100%",
              padding: "8px",
              border: "1px solid #c9cccf",
              borderRadius: "6px",
              fontSize: "14px",
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
        )}
      </div>
    </div>
  );
}
