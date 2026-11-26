// Mini Clemi's pink speed jet, drawn in its own space: nose toward +x, about
// 70 units long, origin at the middle of the fuselage.

// Path2D only exists in the browser, so the shapes are cut on first use.
function cut() {
  return {
    fuselage: new Path2D(
      "M -30 1 C -27 -6 -12 -10.5 6 -9.5 C 20 -8.6 31 -4 39 2.2 C 30 6.4 14 9.6 -4 9.4 C -16 9.2 -26 6.6 -30 1 Z",
    ),
    belly: new Path2D(
      "M -28 3 C -18 7.4 -6 8.6 6 8.3 C 18 8 29 5.6 37 2.6 C 30 6.4 14 9.6 -4 9.4 C -16 9.2 -25 7 -28 3 Z",
    ),
    nose: new Path2D(
      "M 29 -3.6 C 33 -2 36.4 0 39 2.2 C 36 3.7 32.6 5 29 6 C 30.4 3 30.4 -0.6 29 -3.6 Z",
    ),
    fin: new Path2D("M -27 -3 L -38 -19 C -34 -20.4 -29 -19.6 -26 -17 L -12 -7.6 Z"),
    farWing: new Path2D("M 4 -6 L -12 -15.5 C -9 -16.6 -5 -16.2 -2 -14.6 L 14 -6.4 Z"),
    wing: new Path2D("M 8 3.4 L -15 17.5 C -19 18.2 -23 17 -24.6 15 L -7 2.6 Z"),
    stripe: new Path2D("M -24 0.6 C -10 -2.6 10 -2.4 28 1.4"),
    // A low screen ahead of her: it ends below her chin.
    windshield: new Path2D("M 18.4 -8.5 C 19.6 -13.4 23.6 -14.2 27.6 -5.6 C 24.6 -6.9 21.4 -7.9 18.4 -8.5 Z"),
    // The rim of the open cockpit, on the near side of her.
    coaming: new Path2D("M -9.5 -9.7 C -2 -10.9 10 -10.6 19.5 -8.3"),
  };
}

// Mini Clemi's picture looks to its own left, with the orange slice behind
// her head. On the jet it is drawn mirrored, so her face is toward the nose
// and the slice toward the tail; the jet's own flip then turns her with it.
export const PILOT = { size: 33, middle: 2.4, base: -7.4 };

let shapes: ReturnType<typeof cut> | null = null;

export type JetPose = {
  x: number;
  y: number;
  angle: number;
  /** -1 when she is heading left, so the cockpit stays on top. */
  facing: 1 | -1;
  scale: number;
  /** 0 parked, 1 at full speed. */
  thrust: number;
  time: number;
  alpha: number;
};

export function drawJet(
  ctx: CanvasRenderingContext2D,
  pose: JetPose,
  mini: HTMLImageElement | null,
) {
  const { thrust, time } = pose;
  const { fuselage, belly, nose, fin, farWing, wing, stripe, windshield, coaming } = (shapes ??= cut());
  ctx.save();
  ctx.globalAlpha = pose.alpha;
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.angle);
  ctx.scale(pose.scale, pose.scale * pose.facing);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const flicker = 0.78 + 0.22 * Math.sin(time * 0.045) * Math.sin(time * 0.017 + 1.3);
  const flame = (7 + 24 * thrust) * flicker;
  const glow = ctx.createLinearGradient(-30, 0, -30 - flame, 0);
  glow.addColorStop(0, "rgba(255, 255, 255, 0.95)");
  glow.addColorStop(0.35, "rgba(255, 190, 222, 0.85)");
  glow.addColorStop(1, "rgba(255, 130, 190, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.moveTo(-28, -2.6);
  ctx.quadraticCurveTo(-30 - flame * 0.6, -3.4, -30 - flame, 1.6);
  ctx.quadraticCurveTo(-30 - flame * 0.6, 6.2, -28, 5.4);
  ctx.closePath();
  ctx.fill();

  const outline = "#b8346f";
  ctx.lineWidth = 1.15;
  ctx.strokeStyle = outline;

  ctx.fillStyle = "#f58fbb";
  ctx.fill(farWing);
  ctx.stroke(farWing);

  ctx.fillStyle = "#ff5c9f";
  ctx.fill(fin);
  ctx.stroke(fin);

  if (mini?.complete && mini.naturalWidth) {
    // Her whole head stands clear of the jet; the fuselage, drawn next,
    // covers only her collar.
    ctx.save();
    ctx.translate(PILOT.middle, PILOT.base);
    ctx.scale(-1, 1);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(mini, -PILOT.size / 2, -PILOT.size, PILOT.size, PILOT.size);
    ctx.restore();
  }

  const body = ctx.createLinearGradient(0, -10, 0, 10);
  body.addColorStop(0, "#ffc4dc");
  body.addColorStop(0.45, "#ff8fbf");
  body.addColorStop(1, "#ff5c9f");
  ctx.fillStyle = body;
  ctx.fill(fuselage);
  ctx.fillStyle = "rgba(226, 52, 125, 0.34)";
  ctx.fill(belly);
  ctx.fillStyle = "#fff6fa";
  ctx.fill(nose);
  ctx.stroke(fuselage);
  ctx.strokeStyle = "rgba(184, 52, 111, 0.55)";
  ctx.lineWidth = 2.2;
  ctx.stroke(coaming);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = 1.5;
  ctx.stroke(stripe);

  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.15;
  ctx.fillStyle = "rgba(214, 240, 248, 0.55)";
  ctx.fill(windshield);
  ctx.stroke(windshield);

  ctx.fillStyle = "#ffa9cd";
  ctx.fill(wing);
  ctx.stroke(wing);

  if (thrust > 0.25) {
    ctx.strokeStyle = `rgba(255, 150, 200, ${0.5 * thrust})`;
    ctx.lineWidth = 1;
    for (let line = 0; line < 3; line += 1) {
      const drift = ((time * 0.09 + line * 9) % 18) - 4;
      const y = -15 + line * 14.5;
      ctx.beginPath();
      ctx.moveTo(-40 - drift, y);
      ctx.lineTo(-52 - drift - 8 * thrust, y);
      ctx.stroke();
    }
  }

  ctx.restore();
}
