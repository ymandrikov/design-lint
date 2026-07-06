// Rule 10 — hover: on non-interactive elements.
// hover: feedback is only meaningful on elements the user can interact with.

export const id = 10;
export const name = "no-useless-hover";

import {
  parseSource,
  walk,
  jsxName,
  classNameStatics,
  ignoredLines,
  offsetToLine,
} from "../ast.js";

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

// Props whose presence marks an element as interactive (value irrelevant).
const INTERACTION_PROPS = new Set([
  "onClick",
  "onPress",
  "onMouseDown",
  "onKeyDown",
  "onKeyUp",
  "onKeyPress",
  "onDoubleClick",
  "onTouchStart",
  "onPointerDown",
]);
const INTERACTIVE_ROLES = new Set([
  "button",
  "link",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "tab",
  "checkbox",
  "radio",
  "switch",
  "option",
  "treeitem",
]);

// Static string value of a JSX attribute, or null when it isn't a plain string.
// Covers role="button" and role={"button"} and role={`button`} (fixes #10).
function attrStringValue(attr) {
  const v = attr.value;
  if (!v) return null; // boolean attribute (e.g. `disabled`)
  if (v.type === "Literal" && typeof v.value === "string") return v.value;
  if (v.type === "JSXExpressionContainer") {
    const e = v.expression;
    if (e.type === "Literal" && typeof e.value === "string") return e.value;
    if (e.type === "TemplateLiteral" && e.expressions.length === 0) {
      return e.quasis.map((q) => q.value.cooked ?? "").join("");
    }
  }
  return null;
}

function elementIsInteractive(opening, tagName, extraInteractiveTags) {
  if (INTERACTIVE_TAGS.has(tagName)) return true;
  if (TABLE_ROW_TAGS.has(tagName)) return true;
  if (extraInteractiveTags.has(tagName)) return true;
  // Radix namespaced close/trigger primitives always render as interactive elements.
  const lastSegment = tagName.slice(tagName.lastIndexOf(".") + 1);
  if (lastSegment === "Close" || lastSegment === "Trigger") return true;
  // shadcn polymorphic component: `const Comp = asChild ? Slot.Root : "button"`.
  if (tagName === "Comp") return true;

  for (const attr of opening.attributes) {
    if (attr.type !== "JSXAttribute") continue;
    const name = jsxName(attr.name);
    if (INTERACTION_PROPS.has(name)) return true;
    if (name === "href" || name === "tabIndex") return true;
    if (name === "role") {
      const role = attrStringValue(attr);
      if (role && INTERACTIVE_ROLES.has(role)) return true;
    }
  }
  return false;
}

// lintSource(source, filePath, ctx)
// ctx.report(lineNum, message) called for each violation.
export function lintSource(source, filePath, ctx) {
  const { report, ansi, ruleConfig } = ctx;
  const extraInteractiveTags = new Set(ruleConfig?.interactiveElements ?? []);
  const ast = parseSource(source, filePath);
  const ignore = ignoredLines(ast);

  walk(ast.program, (node) => {
    if (node.type !== "JSXOpeningElement") return;
    const tagName = jsxName(node.name);

    // Locate a hover: token in any static className/class value (backtick
    // template values now reach here too — fixes #4).
    let hoverNode = null;
    for (const attr of node.attributes) {
      if (attr.type !== "JSXAttribute") continue;
      const name = jsxName(attr.name);
      if (name !== "className" && name !== "class") continue;
      for (const { text, node: strNode } of classNameStatics(attr.value)) {
        if (text.includes("hover:")) {
          hoverNode = strNode;
          break;
        }
      }
      if (hoverNode) break;
    }
    if (!hoverNode) return;

    const line = offsetToLine(ast.lineStarts, hoverNode.start);
    if (ignore.has(line)) return;
    if (elementIsInteractive(node, tagName, extraInteractiveTags)) return;

    report(
      line,
      `${ansi.red("hover:")} on non-interactive ${ansi.red(`<${tagName}>`)} — remove ${ansi.red("hover:")} or use an interactive element`,
    );
  });
}
