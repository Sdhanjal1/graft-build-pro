import { loadFont as loadBebas } from "@remotion/google-fonts/BebasNeue";
import { loadFont as loadDm } from "@remotion/google-fonts/DMSans";

export const display = loadBebas("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;
export const body = loadDm("normal", { weights: ["400", "500", "700"], subsets: ["latin"] }).fontFamily;

export const colors = {
  ink: "#0E0F0C",
  ink2: "#16170F",
  paper: "#F5F2E9",
  lime: "#CFFF3D",
  limeDim: "#9BC32B",
  mute: "rgba(245,242,233,0.55)",
};
