import { Component, type ErrorInfo, type ReactNode } from "react";

/** Keeps a failed shelf from taking the page with it.
 *
 *  The WebGL direction throws outright when a context can't be created —
 *  headless browsers, hardware acceleration switched off, an old machine, a
 *  driver on Chrome's blocklist. Without a boundary that unmounts the whole
 *  tree including the switcher, so the visitor gets a blank page and no way
 *  back to the CSS shelf, which is the one that would have worked for them. */
export class RenderBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("shelf failed to render", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={S.wrap}>
        <p style={S.head}>This shelf couldn't render</p>
        <p style={S.body}>
          The WebGL direction needs a working WebGL context. Hardware
          acceleration may be switched off, or this browser may not have one.
        </p>
        <p style={S.body}>
          The CSS direction has no such requirement — switch to it below.
        </p>
        <pre style={S.detail}>{this.state.error.message}</pre>
      </div>
    );
  }
}

const S: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 10,
    maxWidth: 460,
    margin: "0 auto",
    padding: 24,
    fontFamily: "ui-monospace, Menlo, monospace",
    fontSize: 13,
    lineHeight: 1.55,
    color: "#3a3a40",
  },
  head: { margin: 0, fontSize: 14, fontWeight: 600, color: "#141416" },
  body: { margin: 0 },
  detail: {
    margin: "4px 0 0",
    padding: "8px 10px",
    background: "#f1efec",
    border: "1px solid #e0ddd8",
    borderRadius: 8,
    fontSize: 11,
    color: "#6a6a72",
    whiteSpace: "pre-wrap",
    overflowX: "auto",
  },
};
