"use client";

import "tippy.js/dist/tippy.css";

import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Code as CodeIcon,
  Eraser,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Paperclip,
  Pencil,
  Quote,
  Redo,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Text as TextIcon,
  Underline as UnderlineIcon,
  Undo,
  Video as VideoIcon,
} from "lucide-react";
import {
  BulletList,
  ListItem,
  ListKeymap,
  OrderedList,
} from "@tiptap/extension-list";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  EditorContent,
  ReactRenderer,
  posToDOMRect,
  useEditor,
} from "@tiptap/react";
import {
  FontFamily,
  FontSize,
  LineHeight,
  TextStyle,
} from "@tiptap/extension-text-style";
import { Node, mergeAttributes } from "@tiptap/core";
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { all, createLowlight } from "lowlight";
import { computePosition, flip, shift } from "@floating-ui/dom";

import Blockquote from "@tiptap/extension-blockquote";
import { Button } from "@/components/ui/button";
import Code from "@tiptap/extension-code";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { ColorHighlightButton } from "@/components/tiptap-ui/color-highlight-button";
import { ColorHighlightPopover } from "@/components/tiptap-ui/color-highlight-popover";
import Highlight from "@tiptap/extension-highlight";
import ImageExtension from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import { Separator } from "@/components/ui/separator";
import { StarterKit } from "@tiptap/starter-kit";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import TextAlign from "@tiptap/extension-text-align";
import { Toggle } from "@/components/ui/toggle";
import Underline from "@tiptap/extension-underline";
import { cn } from "@/lib/utils";
import css from "highlight.js/lib/languages/css";
import html from "highlight.js/lib/languages/xml";
import js from "highlight.js/lib/languages/javascript";
import ts from "highlight.js/lib/languages/typescript";

// ---------------------- lowlight / syntax highlighting ----------------------

const lowlight = createLowlight(all);
lowlight.register("js", js);
lowlight.register("ts", ts);
lowlight.register("html", html);
lowlight.register("css", css);

// -----------------------------------------------------
// Simple video node (block-level, atom)
// -----------------------------------------------------

const VideoBlock = Node.create({
  name: "videoBlock",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      kind: { default: "upload" as "upload" | "embed" },
      provider: { default: null as string | null },
      title: { default: null as string | null },
    };
  },

  parseHTML() {
    return [
      { tag: "video[data-video-block]" },
      { tag: "iframe[data-video-block]" },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = mergeAttributes(HTMLAttributes, {
      class:
        "rounded-md shadow-sm max-w-full border border-slate-200 dark:border-slate-700",
      "data-video-block": "true",
    });

    if (attrs.kind === "embed") {
      return [
        "iframe",
        mergeAttributes(attrs, {
          frameborder: "0",
          allow:
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
          allowfullscreen: "true",
        }),
      ];
    }

    return [
      "video",
      mergeAttributes(attrs, {
        controls: "true",
      }),
    ];
  },
});

// -----------------------------------------------------
// FileAttachmentBlock - Inline node for uploaded files (NEW NODE)
// -----------------------------------------------------

const FileAttachmentBlock = Node.create({
  name: "fileAttachmentBlock",
  group: "inline", // It lives inside a paragraph
  inline: true,    // It's an inline element
  atom: true,      // Treated as a single unit

  addAttributes() {
    return {
      href: { default: null },
      name: { default: null },
    };
  },

  // How Tiptap parses the HTML you were previously inserting
  parseHTML() {
    return [
      {
        tag: 'span[data-attachment="file"] > a',
        getAttrs: (node) => {
          if (typeof node === 'string') return {};
          const a = node.querySelector('a');
          return {
            href: a?.getAttribute('href'),
            name: a?.textContent,
          };
        },
      },
    ];
  },

  // How the node is rendered back to HTML (including your styling)
  renderHTML({ HTMLAttributes }) {
    // Merge standard attributes onto the outer <span> container
    const wrapperAttrs = mergeAttributes(
      {
        class:
          "inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 align-middle mr-1 select-none",
        "data-attachment": "file",
      },
      HTMLAttributes
    );

    return [
      "span",
      wrapperAttrs,
      ["span", { "aria-hidden": "true" }, "📎"], // <-- FIXED SYNTAX HERE
      [
        "a",
        {
          href: HTMLAttributes.href,
          target: "_blank",
          rel: "noopener noreferrer",
          class: "underline font-medium",
        },
        HTMLAttributes.name,
      ],
    ];
  },
});

// -----------------------------------------------------
// CONFIG
// -----------------------------------------------------

const FONT_OPTIONS = [
  { label: "Sans-Serif (Default)", family: "system-ui, sans-serif" },
  { label: "Serif (Georgia)", family: "Georgia, serif" },
  { label: "Monospace (Code)", family: "monospace" },
  { label: "Cursive", family: "cursive" },
];

const HEADING_CLASSES: { [key: number]: string } = {
  1: "text-2xl font-bold",
  2: "text-xl font-bold",
  3: "text-lg font-semibold",
  4: "text-base font-semibold",
  5: "text-sm font-semibold",
  6: "text-xs font-semibold",
};

const SIZE_OPTIONS = [
  { label: "Small", size: "12px" },
  { label: "Normal", size: "16px" },
  { label: "Large", size: "20px" },
  { label: "Huge", size: "24px" },
];

const LINE_HEIGHT_OPTIONS = [
  { label: "Single", height: "1" },
  { label: "1.5", height: "1.5" },
  { label: "Double", height: "2" },
];

const DEFAULT_MAX_CHARS = 10000;

// -----------------------------------------------------
// Mention List
// -----------------------------------------------------

type MentionItem = { id: string; label: string };

interface MentionListProps {
  items: MentionItem[];
  command: (item: { id: string; label: string }) => void;
}

const MentionList = forwardRef<any, MentionListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) props.command(item);
  };

  const upHandler = () => {
    setSelectedIndex(
      (selectedIndex + props.items.length - 1) % props.items.length
    );
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => selectItem(selectedIndex);

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === "ArrowUp") {
        upHandler();
        return true;
      }
      if (event.key === "ArrowDown") {
        downHandler();
        return true;
      }
      if (event.key === "Enter") {
        enterHandler();
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="z-50 min-w-[180px] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md bg-white dark:bg-slate-800">
      {props.items.length ? (
        props.items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
              index === selectedIndex
                ? "bg-accent text-accent-foreground"
                : "hover:bg-muted"
            )}
            onClick={() => selectItem(index)}
          >
            {item.label}
          </button>
        ))
      ) : (
        <div className="px-2 py-1.5 text-sm text-muted-foreground">
          No result
        </div>
      )}
    </div>
  );
});
MentionList.displayName = "MentionList";

// floating-ui helper
const updateFloatingPosition = (editor: any, element: HTMLElement) => {
  const virtualElement = {
    getBoundingClientRect: () =>
      posToDOMRect(
        editor.view,
        editor.state.selection.from,
        editor.state.selection.to
      ),
  };

  computePosition(virtualElement, element, {
    placement: "bottom-start",
    strategy: "absolute",
    middleware: [shift(), flip()],
  }).then(({ x, y }) => {
    element.style.position = "absolute";
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  });
};

const buildMentionSuggestions = (
  mentionUsers: { id: string; name?: string; email: string }[]
) => {
  const makeItems = ({ query }: { query: string }) => {
    const q = (query || "").toLowerCase();
    return mentionUsers
      .map<MentionItem>((u) => ({
        id: u.id,
        label: u.name || u.email,
      }))
      .filter((u) => u.label.toLowerCase().includes(q))
      .slice(0, 5);
  };

  const makeRender = () => {
    let component: ReactRenderer | null = null;

    return {
      onStart: (props: any) => {
        component = new ReactRenderer(MentionList, {
          props: {
            ...props,
            items: props.items,
            command: (item: MentionItem) =>
              props.command({
                id: item.label,
                label: item.label,
              }),
          },
          editor: props.editor,
        });

        if (!props.clientRect || !component?.element) return;

        const editorElement = props.editor.options.element as
          | HTMLElement
          | undefined;

        const editorRoot =
          editorElement?.closest("[data-editor-root]") ||
          editorElement?.parentElement ||
          document.body;

        editorRoot.appendChild(component.element);
        updateFloatingPosition(props.editor, component.element);
      },
      onUpdate(props: any) {
        if (!component) return;

        component.updateProps({
          ...props,
          items: props.items,
          command: (item: MentionItem) =>
            props.command({
              id: item.label,
              label: item.label,
            }),
        });

        if (!props.clientRect || !component.element) return;
        updateFloatingPosition(props.editor, component.element);
      },
      onKeyDown(props: any) {
        if (props.event.key === "Escape") {
          component?.destroy();
          return true;
        }
        // @ts-ignore
        return component?.ref?.onKeyDown(props);
      },
      onExit() {
        component?.destroy();
      },
    };
  };

  return [
    { char: "@", items: makeItems, render: makeRender },
    { char: "#", items: makeItems, render: makeRender },
  ];
};

// -----------------------------------------------------
// Component
// -----------------------------------------------------

export type RichEditorUploadedFile = {
  id: string;
  url: string;
  name: string;
  mimeType?: string | null;
};

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;

  mentionUsers?: { id: string; name?: string; email: string }[];
  onImageButtonClick?: (editor: any) => void;
  onEditImageClick?: (
    editor: any,
    attrs: { src?: string; alt?: string } | null
  ) => void;

  onAttachFile?: (
    file: RichEditorUploadedFile,
    kind: "IMAGE" | "VIDEO" | "FILE"
  ) => void;

  maxCharacters?: number;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  minHeight = "250px",
  mentionUsers,
  onImageButtonClick,
  onEditImageClick,
  onAttachFile,
  maxCharacters = DEFAULT_MAX_CHARS,
}: RichEditorProps) {
  const [charactersCount, setCharactersCount] = useState(0);
  const [wordsCount, setWordsCount] = useState(0);

  const extensions: any[] = [
    StarterKit.configure({
      codeBlock: false,
      code: false,
      blockquote: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
    }),
    TextStyle,
    FontSize,
    FontFamily,
    LineHeight,
    ImageExtension,
    VideoBlock,
    FileAttachmentBlock, // <-- ADDED custom FileAttachmentBlock
    Placeholder.configure({
      placeholder: placeholder || "Write something...",
    }),
    Underline,
    Subscript,
    Superscript,
    Highlight.configure({ multicolor: true }),
    Link.configure({ openOnClick: true, autolink: true }),
    TextAlign.configure({
      types: ["heading", "paragraph"],
      defaultAlignment: "left",
    }),
    BulletList,
    OrderedList,
    ListItem,
    ListKeymap,
    Blockquote,
    Code,
    CodeBlockLowlight.configure({
      lowlight,
      HTMLAttributes: { class: "hljs" },
      enableTabIndentation: true,
    }),
  ];

  if (mentionUsers && mentionUsers.length > 0) {
    extensions.push(
      Mention.configure({
        HTMLAttributes: {
          class:
            "mention font-semibold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-300 px-1 rounded mx-0.5 inline-block",
        },
        deleteTriggerWithBackspace: true,
        suggestions: buildMentionSuggestions(mentionUsers),
      })
    );
  }

  const editor = useEditor({
    extensions,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          "tiptap w-full rounded-md border-0 bg-transparent px-3 py-2 text-sm ring-offset-background",
          "placeholder:text-muted-foreground focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "prose prose-sm dark:prose-invert max-w-none"
        ),
        style: `min-height: ${minHeight};`,
      },
    },
    onCreate: ({ editor }) => {
      const text = editor.getText();
      setCharactersCount(text.length);
      setWordsCount(text.trim() ? text.trim().split(/\s+/).length : 0);
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const text = editor.getText();
      setCharactersCount(text.length);
      setWordsCount(text.trim() ? text.trim().split(/\s+/).length : 0);
      onChange(html);
    },
    content: value,
  });

  // sync external value
  useEffect(() => {
    if (!editor) return;
    if (value === editor.getHTML()) return;
    if (editor.getText() === "" && value === "") return;
    editor.commands.setContent(value);
  }, [value, editor]);

  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);

    if (url === null) return;

    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  };

  const getActiveHeadingLevel = () => {
    if (editor.isActive("paragraph")) return "P";
    for (let i = 1 as const; i <= 6; i++) {
      if (editor.isActive("heading", { level: i })) return `H${i}`;
    }
    return "P";
  };

  const getActiveFontLabel = () => {
    const activeFont = editor.getAttributes("textStyle").fontFamily;
    if (!activeFont) return FONT_OPTIONS[0].label;
    return (
      FONT_OPTIONS.find((f) => f.family === activeFont)?.label ||
      FONT_OPTIONS[0].label
    );
  };

  const getActiveSizeLabel = () => {
    const activeSize = editor.getAttributes("textStyle").fontSize;
    if (!activeSize) return "Normal";
    return SIZE_OPTIONS.find((s) => s.size === activeSize)?.label || activeSize;
  };

  const getActiveLineHeightLabel = () => {
    const activeHeight = editor.getAttributes("textStyle").lineHeight;
    if (!activeHeight) return "1.5";
    return (
      LINE_HEIGHT_OPTIONS.find((h) => h.height === activeHeight)?.label ||
      activeHeight
    );
  };

  const isImageSelected = editor.isActive("image");
  const imageAttrs = isImageSelected ? editor.getAttributes("image") : {};
  const selectedImageAttrs: { src?: string; alt?: string } | null =
    isImageSelected ? imageAttrs : null;

  const percentage =
    maxCharacters > 0
      ? Math.min(100, Math.round((100 / maxCharacters) * charactersCount))
      : 0;

  const reachedLimit = maxCharacters > 0 && charactersCount >= maxCharacters;

  // ---------- helpers for file + video ----------

  const handleFileClick = () => {
    if (typeof window === "undefined") return;

    window.dispatchEvent(
      new CustomEvent("open-file-manager", {
        detail: {
          filter: "files",
          onSelect: (file: RichEditorUploadedFile) => {
            const label =
              file.name ||
              file.url.split("/").pop() ||
              "download-attachment";

            // --- NEW TIPTAP NODE INSERTION ---
            editor
              .chain()
              .focus()
              .insertContent([
                {
                  type: "fileAttachmentBlock",
                  attrs: {
                    href: file.url,
                    name: label,
                  },
                },
                {
                  type: 'text',
                  text: ' ' // Insert a space after the block for easy separation
                }
              ])
              .run();

            onAttachFile?.(file, "FILE");
          },
        },
      })
    );
  };

  const handleVideoClick = () => {
    if (typeof window === "undefined") return;

    const urlInput = window.prompt(
      "Paste video URL (YouTube/Vimeo/direct .mp4).\nLeave empty to pick a video from File Manager."
    );

    if (!urlInput) {
      // pick from File Manager
      window.dispatchEvent(
        new CustomEvent("open-file-manager", {
          detail: {
            filter: "videos",
            onSelect: (file: RichEditorUploadedFile) => {
              editor
                .chain()
                .focus()
                .insertContent({
                  type: "videoBlock",
                  attrs: {
                    src: file.url,
                    kind: "upload",
                    title: file.name || "",
                  },
                })
                .run();

              onAttachFile?.(file, "VIDEO");
            },
          },
        })
      );
      return;
    }

    const raw = urlInput.trim();
    let src = raw;
    let kind: "upload" | "embed" = "upload";
    let provider: string | null = null;

    if (/youtu\.be|youtube\.com/.test(raw)) {
      const match = raw.match(
        /(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{6,})/
      );
      const id = match?.[1];
      if (id) {
        src = `https://www.youtube.com/embed/${id}`;
        kind = "embed";
        provider = "youtube";
      } else {
        kind = "embed";
        provider = "youtube";
      }
    } else if (/vimeo\.com/.test(raw)) {
      kind = "embed";
      provider = "vimeo";
    } else if (/\.(mp4|webm|ogg)$/i.test(raw)) {
      kind = "upload";
    } else {
      kind = "embed";
    }

    editor
      .chain()
      .focus()
      .insertContent({
        type: "videoBlock",
        attrs: {
          src,
          kind,
          provider,
          title: "",
        },
      })
      .run();
  };

  return (
    <div
      data-editor-root
      className={cn(
        "flex flex-col rounded-xl border border-slate-200/80 dark:border-slate-800/80",
        "bg-white/95 dark:bg-slate-950/95 shadow-sm",
        className
      )}
    >
      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 dark:border-slate-800 p-2 bg-slate-50/80 dark:bg-slate-900/80 rounded-t-xl">
        {/* FONT SIZE */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 min-w-[50px] justify-start"
              title="Font Size"
            >
              <TextIcon className="h-4 w-4 mr-1" />
              {getActiveSizeLabel()}
              <ChevronDown className="h-4 w-4 ml-auto" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-36 p-1">
            {SIZE_OPTIONS.map((size, index) => (
              <DropdownMenuItem
                key={index}
                onClick={() =>
                  editor.chain().focus().setFontSize(size.size).run()
                }
                className={cn(
                  "cursor-pointer",
                  editor.isActive("textStyle", { fontSize: size.size }) &&
                    "bg-accent font-semibold"
                )}
              >
                {size.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              onClick={() => editor.chain().focus().unsetFontSize().run()}
              className="cursor-pointer"
            >
              [Reset Size]
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* FONT FAMILY */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 font-semibold min-w-[140px] justify-start"
              title="Font Family"
            >
              {getActiveFontLabel()}
              <ChevronDown className="h-4 w-4 ml-auto" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-40 p-1">
            {FONT_OPTIONS.map((font, index) => (
              <DropdownMenuItem
                key={index}
                onClick={() =>
                  editor.chain().focus().setFontFamily(font.family).run()
                }
                className={cn(
                  "cursor-pointer",
                  editor.isActive("textStyle", { fontFamily: font.family }) &&
                    "bg-accent font-semibold"
                )}
                style={{ fontFamily: font.family }}
              >
                {font.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              onClick={() => editor.chain().focus().unsetFontFamily().run()}
              className="cursor-pointer"
            >
              [Reset Font]
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* HEADING / PARAGRAPH */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 gap-1 font-semibold min-w-[50px] justify-start",
                (editor.isActive("heading") || editor.isActive("paragraph")) &&
                  "bg-muted hover:bg-muted"
              )}
              title="Heading Style"
            >
              {getActiveHeadingLevel()}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="min-w-40 p-1">
            <DropdownMenuItem
              onClick={() => editor.chain().focus().setParagraph().run()}
              className={cn(
                "cursor-pointer",
                editor.isActive("paragraph") && "bg-accent font-semibold"
              )}
            >
              P Paragraph
            </DropdownMenuItem>

            {([1, 2, 3, 4] as const).map((level) => (
              <DropdownMenuItem
                key={level}
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level }).run()
                }
                className={cn(
                  "cursor-pointer",
                  HEADING_CLASSES[level],
                  editor.isActive("heading", { level }) &&
                    "bg-accent font-semibold"
                )}
              >
                {`H${level} Heading ${level}`}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* LINE HEIGHT */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 min-w-[50px] justify-start"
              title="Line Height"
            >
              <ListOrdered className="h-4 w-4 mr-1 rotate-90" />
              {getActiveLineHeightLabel()}
              <ChevronDown className="h-4 w-4 ml-auto" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-36 p-1">
            {LINE_HEIGHT_OPTIONS.map((lh, index) => (
              <DropdownMenuItem
                key={index}
                onClick={() =>
                  editor.chain().focus().setLineHeight(lh.height).run()
                }
                className={cn(
                  "cursor-pointer",
                  editor.isActive("textStyle", { lineHeight: lh.height }) &&
                    "bg-accent font-semibold"
                )}
              >
                {lh.label} ({lh.height})
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              onClick={() => editor.chain().focus().unsetLineHeight().run()}
              className="cursor-pointer"
            >
              [Reset Height]
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* BASIC MARKS */}
        <Toggle
          size="sm"
          pressed={editor.isActive("bold")}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </Toggle>

        <Toggle
          size="sm"
          pressed={editor.isActive("italic")}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </Toggle>

        <Toggle
          size="sm"
          pressed={editor.isActive("underline")}
          onPressedChange={() =>
            editor.chain().focus().toggleUnderline().run()
          }
          title="Underline"
        >
          <UnderlineIcon className="h-4 w-4" />
        </Toggle>

        <Toggle
          size="sm"
          pressed={editor.isActive("strike")}
          onPressedChange={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </Toggle>

        <Toggle
          size="sm"
          pressed={editor.isActive("highlight")}
          onPressedChange={() =>
            editor.chain().focus().toggleHighlight().run()
          }
          title="Highlight"
        >
          <Highlighter className="h-4 w-4" />
        </Toggle>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* COLOR HIGHLIGHT */}
        <div className="flex items-center gap-1 mr-1">
          <ColorHighlightButton
            editor={editor}
            tooltip="Yellow Highlight"
            highlightColor="var(--tt-color-highlight-yellow)"
            hideWhenUnavailable={true}
            showShortcut={false}
            onApplied={({ color, label }) =>
              console.log(`Applied ${label} highlight: ${color}`)
            }
          />
        </div>
        <ColorHighlightPopover
          editor={editor}
          hideWhenUnavailable={true}
          onApplied={({ color, label }) =>
            console.log(`Applied highlight: ${label} (${color})`)
          }
        />

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* SUB/SUPER + LINK */}
        <Toggle
          size="sm"
          pressed={editor.isActive("subscript")}
          onPressedChange={() =>
            editor.chain().focus().toggleSubscript().run()
          }
          title="Subscript (x₂)"
        >
          <SubscriptIcon className="h-4 w-4" />
        </Toggle>

        <Toggle
          size="sm"
          pressed={editor.isActive("superscript")}
          onPressedChange={() =>
            editor.chain().focus().toggleSuperscript().run()
          }
          title="Superscript (x²)"
        >
          <SuperscriptIcon className="h-4 w-4" />
        </Toggle>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={setLink}
          title={editor.isActive("link") ? "Unlink" : "Set Link"}
        >
          <LinkIcon
            className={cn(
              "h-4 w-4",
              editor.isActive("link") && "text-indigo-500"
            )}
          />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* LISTS & QUOTE & CODE BLOCK */}
        <Toggle
          size="sm"
          pressed={editor.isActive("bulletList")}
          onPressedChange={() =>
            editor.chain().focus().toggleBulletList().run()
          }
          title="Bulleted List"
        >
          <List className="h-4 w-4" />
        </Toggle>

        <Toggle
          size="sm"
          pressed={editor.isActive("orderedList")}
          onPressedChange={() =>
            editor.chain().focus().toggleOrderedList().run()
          }
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </Toggle>

        <Toggle
          size="sm"
          pressed={editor.isActive("blockquote")}
          onPressedChange={() =>
            editor.chain().focus().toggleBlockquote().run()
          }
          title="Blockquote"
        >
          <Quote className="h-4 w-4" />
        </Toggle>

        <Toggle
          size="sm"
          pressed={editor.isActive("codeBlock")}
          onPressedChange={() =>
            editor.chain().focus().toggleCodeBlock().run()
          }
          title="Code Block"
        >
          <CodeIcon className="h-4 w-4" />
        </Toggle>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* ALIGNMENT */}
        <Toggle
          size="sm"
          pressed={editor.isActive({ textAlign: "left" })}
          onPressedChange={() =>
            editor.chain().focus().setTextAlign("left").run()
          }
          title="Align Left"
        >
          <AlignLeft className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive({ textAlign: "center" })}
          onPressedChange={() =>
            editor.chain().focus().setTextAlign("center").run()
          }
          title="Align Center"
        >
          <AlignCenter className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive({ textAlign: "right" })}
          onPressedChange={() =>
            editor.chain().focus().setTextAlign("right").run()
          }
          title="Align Right"
        >
          <AlignRight className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive({ textAlign: "justify" })}
          onPressedChange={() =>
            editor.chain().focus().setTextAlign("justify").run()
          }
          title="Justify"
        >
          <AlignJustify className="h-4 w-4" />
        </Toggle>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* IMAGES / FILES / VIDEO */}
        {onImageButtonClick && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onImageButtonClick(editor)}
            title="Insert Image from File Manager"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
        )}

        {onEditImageClick && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEditImageClick(editor, selectedImageAttrs)}
            disabled={!isImageSelected}
            title={
              isImageSelected ? "Edit Selected Image" : "Select an image to edit"
            }
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleFileClick}
          title="Insert File from File Manager"
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleVideoClick}
          title="Insert Video (URL or File Manager)"
        >
          <VideoIcon className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* CLEAR / UNDO / REDO */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal Rule"
        >
          <Minus className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() =>
            editor.chain().focus().clearNodes().unsetAllMarks().run()
          }
          title="Clear Formatting"
        >
          <Eraser className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        >
          <Undo className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        >
          <Redo className="h-4 w-4" />
        </Button>
      </div>

      {/* CONTENT */}
      <div
        className="relative p-3 bg-slate-50/40 dark:bg-slate-900/40 rounded-b-xl"
        style={{ minHeight }}
      >
        <EditorContent editor={editor} />
      </div>

      {/* COUNTER */}
      <div
        className={cn(
          "border-t border-slate-100 dark:border-slate-800 px-2 py-1.5 text-[11px]",
          "flex items-center justify-end gap-2 text-muted-foreground",
          "bg-slate-50/60 dark:bg-slate-900/70 rounded-b-xl",
          reachedLimit && "text-red-500"
        )}
      >
        {maxCharacters > 0 && (
          <svg height="16" width="16" viewBox="0 0 20 20">
            <circle r="10" cx="10" cy="10" fill="#e9ecef" />
            <circle
              r="5"
              cx="10"
              cy="10"
              fill="transparent"
              stroke="currentColor"
              strokeWidth="10"
              strokeDasharray={`calc(${percentage} * 31.4 / 100) 31.4`}
              transform="rotate(-90) translate(-20)"
            />
            <circle r="6" cx="10" cy="10" fill="white" />
          </svg>
        )}
        <span>
          {charactersCount} / {maxCharacters} characters
        </span>
        <span className="h-3 w-px bg-slate-300/60" />
        <span>{wordsCount} words</span>
      </div>
    </div>
  );
}