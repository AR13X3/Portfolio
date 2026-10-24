/** Layout offset of `el` inside `ancestor`, ignoring transforms (they belong to the motion). */
export function offsetWithin(el: HTMLElement, ancestor: HTMLElement) {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== ancestor) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

/**
 * A tweenable value whose setter writes to the page. GSAP calls a function property as a
 * getter/setter, and it sets values even when ScrollTrigger renders with events suppressed
 * (a refresh, a jump), where an onUpdate callback would be skipped and leave stale output.
 */
export function setter(apply: (v: number) => void, initial = 0) {
  let current = initial;
  return {
    v(value?: number) {
      if (value === undefined) return current;
      current = value;
      apply(value);
      return current;
    },
  };
}
