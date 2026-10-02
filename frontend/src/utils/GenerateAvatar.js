const generateDiceBear = (style, seed) =>
  `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;

export const generateAvatar = () => {
  const data = [];
  const styles = ["avataaars", "bottts", "lorelei"];

  styles.forEach((style) => {
    for (let i = 0; i < 2; i++) {
      data.push(generateDiceBear(style, `${style}-${Math.random()}`));
    }
  });

  return data;
};
