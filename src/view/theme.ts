// 종이 · 인쇄 색과 9가지 컬러 컨셉 (원본 Theme.swift Ink · ColorConcept)

export const Ink = {
  paper: "#FCFBF7",
  paperBack: "#F2EFE8",
  print: "#2B2B2F",
  rule: "#C9C6BF",
  dot: "#B5B1A9",
  text: "#34333A",
  soft: "#9A96A0",
  faint: "#C9C5CB",
  red: "#E0474C",
};

export interface Concept { id: number; name: string; accent: string; tint: string; }

export const concepts: Concept[] = [
  { id: 0, name: "체리", accent: "#E0474C", tint: "#F7C3C5" },
  { id: 1, name: "코랄", accent: "#EE6F4F", tint: "#FAD0C2" },
  { id: 2, name: "머스타드", accent: "#D39A12", tint: "#F5E2A0" },
  { id: 3, name: "민트", accent: "#23A08A", tint: "#BDE8DD" },
  { id: 4, name: "스카이", accent: "#3A86D4", tint: "#C6DCF5" },
  { id: 5, name: "네이비", accent: "#2E3D7C", tint: "#C9CFE8" },
  { id: 6, name: "라벤더", accent: "#8466CC", tint: "#DCD1F4" },
  { id: 7, name: "핑크", accent: "#DE5C8A", tint: "#F8CADB" },
  { id: 8, name: "차콜", accent: "#3A3940", tint: "#DAD8D2" },
];

export const conceptOf = (id: number): Concept => concepts[Math.min(Math.max(id, 0), concepts.length - 1)];

export const hex = (h: string): string => (h.startsWith("#") ? h : `#${h}`);
