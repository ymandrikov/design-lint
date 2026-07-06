// Minimal shadcn-style UI component. Its presence in componentsDirectory
// makes <Button> a protected component for no-component-color-override.
export function Button({ className, ...props }: { className?: string } & Record<string, unknown>) {
  return <button className={className} {...props} />;
}
