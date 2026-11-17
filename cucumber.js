module.exports = {
  default: {
    paths: ["features/**/*.feature"],
    require: ["tests/step_definitions/**/*.ts"],
    requireModule: ["ts-node/register"]
  }
};
