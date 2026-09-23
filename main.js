module.exports = function activate(ctx) {
  ctx.log("osu!mania exporter main activated", ctx.id);

  ctx.registerHandler("info", function () {
    return {
      format: "osu",
      mode: "mania",
      formats: ["osu"],
      version: "0.1.0",
    };
  });

  ctx.onDispose(function () {
    ctx.log("osu!mania exporter main disposed");
  });
};
