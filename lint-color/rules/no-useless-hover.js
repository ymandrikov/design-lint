// Rule 10 — hover: on non-interactive elements.
// hover: feedback is only meaningful on elements the user can interact with.

export const id = 10;
export const name = "no-useless-hover";

import {
  buildLineStarts,
  extractJsxOpeningTags,
  offsetToLine,
} from "../shared.js";

// Elements and components that are inherently interactive (hover feedback is valid).
const INTERACTIVE_TAGS = new Set([
  // HTML
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "label",
  "summary",
  // shadcn / Radix interactive components
  "Button",
  "Link",
  "NavLink",
  "Toggle",
  "ToggleGroupItem",
  "Checkbox",
  "Switch",
  "RadioGroupItem",
  "Slider",
  "SidebarMenuButton",
  "SidebarMenuAction",
  "DropdownMenuItem",
  "ContextMenuItem",
  "MenubarItem",
  "CommandItem",
  "AccordionTrigger",
  "CollapsibleTrigger",
  "DialogTrigger",
  "SheetTrigger",
  "AlertDialogTrigger",
  "PopoverTrigger",
  "TooltipTrigger",
  "HoverCardTrigger",
  "SelectTrigger",
  "TabsTrigger",
  "NavigationMenuLink",
  "NavigationMenuTrigger",
  "PaginationLink",
]);

// Table rows: hover highlight is an intentional row-level affordance.
const TABLE_ROW_TAGS = new Set(["TableRow", "tr"]);

const INTERACTION_PROP_RE =
  /\bon(?:Click|Press|MouseDown|KeyDown|KeyUp|KeyPress|DoubleClick|TouchStart|PointerDown)\s*[={]/;
const INTERACTIVE_ROLE_RE =
  /\brole\s*=\s*["'`](?:button|link|menuitem|menuitemcheckbox|menuitemradio|tab|checkbox|radio|switch|option|treeitem)["'`]/;

function tagIsInteractive(tagName, tagContent, extraInteractiveTags) {
  if (INTERACTIVE_TAGS.has(tagName)) return true;
  if (TABLE_ROW_TAGS.has(tagName)) return true;
  if (extraInteractiveTags.has(tagName)) return true;
  // Radix namespaced close/trigger primitives always render as interactive elements.
  const lastSegment = tagName.slice(tagName.lastIndexOf(".") + 1);
  if (lastSegment === "Close" || lastSegment === "Trigger") return true;
  // shadcn polymorphic component: `const Comp = asChild ? Slot.Root : "button"`.
  if (tagName === "Comp") return true;
  if (INTERACTION_PROP_RE.test(tagContent)) return true;
  if (INTERACTIVE_ROLE_RE.test(tagContent)) return true;
  if (/\bhref\s*[={]/.test(tagContent)) return true;
  if (/\btabIndex\s*[={]/.test(tagContent)) return true;
  return false;
}

// Scan tagContent for `hover:` inside any string literal ("..." or '...').
// Returns the offset within tagContent where hover: starts, or -1.
function findHoverInTagStrings(tagContent) {
  const re = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g;
  let m;
  while ((m = re.exec(tagContent)) !== null) {
    const str = m[1] !== undefined ? m[1] : m[2];
    const idx = str.indexOf("hover:");
    if (idx !== -1) return m.index + 1 + idx; // +1 skips opening quote
  }
  return -1;
}

// lintSource(source, filePath, ctx)
// ctx.report(lineNum, message) called for each violation.
export function lintSource(source, filePath, ctx) {
  const { report, ansi, ruleConfig } = ctx;
  const extraInteractiveTags = new Set(ruleConfig?.interactiveElements ?? []);
  const lineStarts = buildLineStarts(source);

  for (const { tagName, content, startOffset } of extractJsxOpeningTags(source)) {
    if (!content.includes("hover:")) continue;

    const hoverOffset = findHoverInTagStrings(content);
    if (hoverOffset === -1) continue;

    const absOffset = startOffset + hoverOffset;
    const lineNum = offsetToLine(lineStarts, absOffset);

    // Respect the shared suppress comment.
    const lineEnd = lineStarts[lineNum] ?? source.length;
    const lineText = source.slice(lineStarts[lineNum - 1], lineEnd);
    if (lineText.includes("color-lint-ignore")) continue;

    if (!tagIsInteractive(tagName, content, extraInteractiveTags)) {
      report(
        lineNum,
        `${ansi.red("hover:")} on non-interactive ${ansi.red(`<${tagName}>`)} — remove ${ansi.red("hover:")} or use an interactive element`,
      );
    }
  }
}
