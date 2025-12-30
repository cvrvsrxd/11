import { CSSProperties } from "react";

interface XIconProps {
  className?: string;
  style?: CSSProperties;
}

const XIcon = ({ className = "w-5 h-5", style }: XIconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="currentColor" className={className} style={style}>
    <path d="M8.9695 2h1.357L7.3619 5.3884l3.4877 4.6108H8.1188L5.9799 7.2028 3.5326 9.9992H2.1748l3.171-3.6243L2 2h2.8001l1.9334 2.556zm-.4762 7.187h.752L4.3914 2.7695h-.8068z"/>
  </svg>
);

export default XIcon;
