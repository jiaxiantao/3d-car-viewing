export type ShowroomCapabilityFlags = {
  modelLabel: string;
  leftDoor: boolean;
  rightDoor: boolean;
  trunk: boolean;
  sunroof: boolean;
  wheels: boolean;
};

const BODY_LABELS = [
  ["leftDoor", "左门"],
  ["rightDoor", "右门"],
  ["trunk", "后备箱"],
  ["sunroof", "天窗"],
] as const;

/**
 * One line for the canvas and the remote-model prompt.
 * Returns null when every listed part can move on its own.
 */
export function showroomCapabilityNote(flags: ShowroomCapabilityFlags): string | null {
  const blocked = BODY_LABELS.filter(([key]) => !flags[key]).map(([, label]) => label);
  if (blocked.length === 0 && flags.wheels) {
    return null;
  }
  const body =
    blocked.length > 0
      ? `${flags.modelLabel}不能单独打开${blocked.join("、")}，这些部件和车身连在一起，按钮已禁用。`
      : "";
  const wheels = flags.wheels ? "" : "车轮和车身连在一起，启动后只有整车动态。";
  return `${body}${wheels}车灯、双闪和启动仍然可用。`;
}
