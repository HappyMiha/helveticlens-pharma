/** Keep cited findings reachable when the surrounding evidence is collapsed. */
export function revealResearchTarget(target: HTMLElement | null) {
  for (let parent = target?.parentElement; parent; parent = parent.parentElement) {
    if (parent.tagName === 'DETAILS') (parent as HTMLDetailsElement).open = true;
  }
}
