import type { FC } from 'react';

interface IconProps {
  name: string;
  size?: number;
}

const Icon: FC<IconProps> = ({ name, size = 16 }) => {
  const paths: Record<string, React.ReactNode> = {
    search: <path d="M10.5 10.5L14 14M12 6.75a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0z" />,
    plus:   <path d="M8 3v10M3 8h10" />,
    x:      <path d="M3.5 3.5l9 9m-9 0l9-9" />,
    check:  <path d="M3 8.5l3 3 7-7" />,
    chevL:  <path d="M10 3L5 8l5 5" />,
    chevR:  <path d="M6 3l5 5-5 5" />,
    chevD:  <path d="M3 6l5 5 5-5" />,
    chevU:  <path d="M3 10l5-5 5 5" />,
    arrowR: <path d="M3 8h10m-4-4l4 4-4 4" />,
    filter: <path d="M2 3h12l-4.5 6v4l-3 1.5V9L2 3z" />,
    table:  <path d="M2 4h12v8H2zM2 7.5h12M6 4v8M10 4v8" />,
    board:  <path d="M2 3h3.5v10H2zM6.5 3H10v6.5H6.5zM11 3h3v4h-3z" />,
    list:   <path d="M2 4h12M2 8h12M2 12h12" />,
    edit:   <path d="M11 3l2 2-7 7-2.5.5.5-2.5 7-7z" />,
    trash:  <path d="M3 4.5h10M5.5 4.5V3h5v1.5M4 4.5l.5 8.5h7l.5-8.5" />,
    more:   <><circle cx="3.5" cy="8" r="1" /><circle cx="8" cy="8" r="1" /><circle cx="12.5" cy="8" r="1" /></>,
    kanban: <path d="M2 3h12v10H2zM6 3v10M10 3v10M3 5h2M7 5h2M11 5h2M3 8h2M7 8h2M3 11h2" />,
    calendar: <path d="M2.5 4.5h11v8.5h-11zM5 3v3M11 3v3M2.5 7h11" />,
    coin:   <><circle cx="8" cy="8" r="5.5" /><path d="M8 5v6M6 6.5c.5-.6 1.2-.8 2-.8s2 .4 2 1.3-1 1-2 1-2 0-2 1 1 1.3 2 1.3 1.5-.2 2-.8" /></>,
    user:   <path d="M8 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM3 13.5C3 11 5 9.5 8 9.5s5 1.5 5 4" />,
    bell:   <path d="M4 6a4 4 0 0 1 8 0v3l1 2H3l1-2V6zM6.5 13a1.5 1.5 0 0 0 3 0" />,
    grid:   <path d="M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3zM9 9h4v4H9z" />,
    inbox:  <path d="M2.5 3.5h11l-1 6H3.5l-1-6zM2.5 9.5v3h11v-3M6 9.5c0 1 .7 1.5 2 1.5s2-.5 2-1.5" />,
    clock:  <><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3l2 1.5" /></>,
    pin:    <path d="M8 2l-2 4H3l3 3-1 4 3-2 3 2-1-4 3-3h-3l-2-4z" />,
    flame:  <path d="M8 14c-2.5 0-4-1.8-4-4 0-2 1.5-3 1.5-4.5C5.5 4 6.5 3 7 2c0 2 3 3 3 6 0 1 1 1.5 1 3 0 2-1 3-3 3z" />,
    tag:    <path d="M3 3h5l5 5-5 5-5-5V3zM6 6a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z" />,
    link:   <path d="M7 9l2-2M6 10l-1 1a2 2 0 0 1-2.8-2.8L4 6.5M10 5.5L11.2 4a2 2 0 0 1 2.8 2.8L12.5 8" />,
    sun:    <><circle cx="8" cy="8" r="3" /><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4" /></>,
    moon:   <path d="M12.5 9.5A5 5 0 0 1 6.5 3.5a5.5 5.5 0 1 0 6 6z" />,
    lang:   <><circle cx="8" cy="8" r="6" /><path d="M2 8h12M8 2a9 9 0 0 1 0 12M8 2a9 9 0 0 0 0 12" /></>,
    star:   <path d="M8 2l1.8 3.8 4.2.6-3 2.9.7 4.1L8 11.5 4.3 13.4l.7-4.1-3-2.9 4.2-.6L8 2z" />,
    sliders: <path d="M3 4h8M13 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM3 8h2M13 8H7M5 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM3 12h7M13 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />,
    cmd:    <path d="M4 10a1.5 1.5 0 1 0 0-3h8a1.5 1.5 0 1 0 0 3M4 10h8M5.5 10v1a1.5 1.5 0 0 1-3 0M10.5 10v1a1.5 1.5 0 0 0 3 0M5.5 7V6a1.5 1.5 0 0 0-3 0M10.5 7V6a1.5 1.5 0 0 1 3 0" />,
    dot:    <circle cx="8" cy="8" r="2.5" />,
    arrowUp:   <path d="M8 13V3m0 0L4 7m4-4l4 4" />,
    arrowDown: <path d="M8 3v10m0 0l4-4m-4 4l-4-4" />,
    settings: <><circle cx="8" cy="8" r="2.5" /><path d="M9.9 2.7l.8 1.3h1.5l.8 1.4-1 1.1.2 1.5-1.4.7-1 1.3H8.2L7 11l-1.5-.7.2-1.5-1-1.1.8-1.4h1.5l.8-1.3h2.1z" /></>,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
};

export default Icon;
