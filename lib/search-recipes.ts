import type { DiscoveryResult, SearchRecipe } from './contracts';

/** Save the displayed search, excluding result records and execution claims. */
export function recipeFromResult(result: DiscoveryResult): SearchRecipe {
  return {
    query: result.query,
    provider: result.provider,
    match_mode:
      result.provider === 'workspace' ? result.match_mode || 'all' : null,
  };
}

export function recipeLabel(recipe: SearchRecipe) {
  if (recipe.provider === 'workspace')
    return `Team knowledge · ${recipe.match_mode === 'phrase' ? 'Exact phrase' : 'All words'}`;
  return recipe.provider === 'fedlex'
    ? 'Fedlex · official laws'
    : 'Europe PMC · literature';
}
