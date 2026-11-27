import type { AtlasModuleId, AtlasModuleManifest } from './types';
import residence from './residence/manifest';
import actions from './actions/manifest';
import goals from './goals/manifest';
import calendar from './calendar/manifest';
import habits from './habits/manifest';
import learning from './learning/manifest';
import growth from './growth/manifest';
import values from './values/manifest';

/**
 * The shell consumes public module metadata from this registry. The Qur'an
 * reader remains shell-owned and is deliberately excluded from this registry.
 */
export const atlasModules: readonly AtlasModuleManifest[] = [
  residence,
  actions,
  goals,
  calendar,
  habits,
  learning,
  growth,
  values
] as const;

export function getAtlasModule(id: AtlasModuleId): AtlasModuleManifest | undefined {
  return atlasModules.find(module => module.id === id);
}
