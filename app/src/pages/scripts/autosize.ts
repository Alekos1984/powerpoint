/** Grows a textarea to fit its content instead of leaving long text scrolled/clipped inside a fixed-height box. */
export function autosizeTextarea(el: HTMLTextAreaElement): void {
  const resize = () => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  el.addEventListener("input", resize);
  resize();
}
