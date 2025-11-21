"use client";

import React, { useEffect } from "react";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import Underline from "@tiptap/extension-underline";
import Strike from "@tiptap/extension-strike";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
// Import icons
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
} from "lucide-react";

// Define types for parameters, removing heading level
type ToolbarButtonParams = { textAlign: string } | undefined;

interface TiptapToolbarProps {
  editor: Editor | null;
}

/**
 * Toolbar component for the Tiptap editor.
 * Renders buttons for common formatting actions.
 * @param {TiptapToolbarProps} props Component props.
 * @returns {JSX.Element | null} The toolbar or null if editor isn't available.
 */
const TiptapToolbar: React.FC<TiptapToolbarProps> = ({ editor }) => {
  if (!editor) {
    return null;
  }

  // Helper function for button className based on active state
  const getButtonClass = (
    action: string,
    params?: ToolbarButtonParams
  ): string => {
    const baseClass =
      "p-1 rounded hover:bg-accent hover:text-accent-foreground";
    const activeClass = editor.isActive(action, params)
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground";
    return `${baseClass} ${activeClass}`;
  };

  return (
    <div className="border border-input bg-transparent rounded-t-md p-1 flex flex-wrap gap-1">
      <button
        key="bold"
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={getButtonClass("bold")}
        aria-label="Toggle bold"
      >
        <Bold className="w-4 h-4" />
      </button>
      <button
        key="italic"
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={getButtonClass("italic")}
        aria-label="Toggle italic"
      >
        <Italic className="w-4 h-4" />
      </button>
      <button
        key="underline"
        type="button"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        disabled={!editor.can().chain().focus().toggleUnderline().run()}
        className={getButtonClass("underline")}
        aria-label="Toggle underline"
      >
        <UnderlineIcon className="w-4 h-4" />
      </button>
      <button
        key="strike"
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        className={getButtonClass("strike")}
        aria-label="Toggle strikethrough"
      >
        <Strikethrough className="w-4 h-4" />
      </button>
      <button
        key="alignLeft"
        type="button"
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        className={getButtonClass("textAlign", { textAlign: "left" })}
        aria-label="Align left"
      >
        <AlignLeft className="w-4 h-4" />
      </button>
      <button
        key="alignCenter"
        type="button"
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        className={getButtonClass("textAlign", { textAlign: "center" })}
        aria-label="Align center"
      >
        <AlignCenter className="w-4 h-4" />
      </button>
      <button
        key="alignRight"
        type="button"
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        className={getButtonClass("textAlign", { textAlign: "right" })}
        aria-label="Align right"
      >
        <AlignRight className="w-4 h-4" />
      </button>
      <button
        key="alignJustify"
        type="button"
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        className={getButtonClass("textAlign", { textAlign: "justify" })}
        aria-label="Align justify"
      >
        <AlignJustify className="w-4 h-4" />
      </button>
      <button
        key="bulletList"
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={getButtonClass("bulletList")}
        aria-label="Toggle bullet list"
      >
        <List className="w-4 h-4" />
      </button>
      <button
        key="orderedList"
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={getButtonClass("orderedList")}
        aria-label="Toggle ordered list"
      >
        <ListOrdered className="w-4 h-4" />
      </button>
      {/* Add more buttons for other actions (underline, strike, code, blockquote, etc.) here */}
    </div>
  );
};

interface TiptapEditorProps {
  value: string;
  onChange?: (richText: string) => void;
  placeholder?: string;
  maxLength?: number;
  onCharacterCountChange?: (count: number) => void;
  editable?: boolean;
}

/**
 * A basic Tiptap rich text editor component with a toolbar.
 * Integrates with react-hook-form.
 *
 * @param {TiptapEditorProps} props Component props.
 * @returns {JSX.Element} The Tiptap editor component.
 */
const TiptapEditor: React.FC<TiptapEditorProps> = ({
  value,
  onChange,
  placeholder,
  maxLength,
  onCharacterCountChange,
  editable = true,
}) => {
  const editor = useEditor({
    editable,
    extensions: [
      StarterKit.configure({
        // Disable default heading levels
        heading: false,
        // Potentially disable code blocks if not desired for descriptions
        codeBlock: false,
        strike: false,
        // Add custom styling classes here
        paragraph: {
          HTMLAttributes: {
            class: "mb-2", // Add bottom margin to paragraphs
          },
        },
        bold: {
          HTMLAttributes: {
            class: "font-semibold", // Make bold text semibold
          },
        },
        bulletList: {
          HTMLAttributes: {
            class: "list-disc pl-5 mb-2", // Style bullet lists
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: "list-decimal pl-5 mb-2", // Style ordered lists
          },
        },
        listItem: {
          HTMLAttributes: {
            class: "mb-1", // Add margin below list items
          },
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || "Write something...",
      }),
      CharacterCount.configure({
        limit: maxLength,
      }),
      Underline,
      Strike,
      TextStyle,
      TextAlign.configure({
        types: [/*"heading",*/ "paragraph"],
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: `rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground ${
          editable
            ? "focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            : "focus-visible:outline-none border-none shadow-none ring-0"
        } disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px] ${
          editable ? "rounded-b-md" : ""
        }`,
      },
    },
    onUpdate({ editor }) {
      if (onChange && editable) {
        onChange(editor.getHTML());
      }
      if (onCharacterCountChange && editable) {
        onCharacterCountChange(editor.storage.characterCount.characters());
      }
    },
  });

  useEffect(() => {
    if (editor && !editor.isFocused && value !== editor.getHTML()) {
      editor.commands.setContent(value, false);
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div
      className={`tiptap-editor ${
        editable ? "rounded-md border border-input" : ""
      }`}
    >
      {editable && <TiptapToolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
};

export default TiptapEditor;
