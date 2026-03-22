const fs = require("fs");
const path = require("path");

module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("videos");
  eleventyConfig.addPassthroughCopy("projectCover");
  eleventyConfig.addPassthroughCopy("CLIENTS_SBM");
  eleventyConfig.addPassthroughCopy("sbmlogo.webp");
  eleventyConfig.addPassthroughCopy("sbmlogolt.webp");
  eleventyConfig.addPassthroughCopy("robots.txt");
  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data"
    }
  };
};
