// 完成済みの4コマをそのまま使い、描かれた脚・靴・影を切り離さない。
export function walkerFrame(phase, moving) {
  if (!moving) return 1;
  const wrapped = ((phase % 1) + 1) % 1;
  // 静止画と同じ通過姿勢から歩き始める。
  return (Math.floor(wrapped * 4) + 1) % 4;
}

export function drawWalker(ctx, sprite, meta, col, phase, moving) {
  const [width, height] = meta.cell;
  const frame = walkerFrame(phase, moving);
  ctx.drawImage(sprite, col * width, frame * height, width, height, 0, 0, width, height);
}
