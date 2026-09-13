/**
 * ルール説明ポップアップに添える簡易イラスト(仮のサンプル画像)。
 * 本番の見た目が固まったら、実際のゲーム画面のスクリーンショットに差し替える想定。
 */

function Piece({ x, y, color }: { x: number; y: number; color: string }) {
  return <circle cx={x} cy={y} r={9} fill={color} stroke="#222" strokeWidth={1} />;
}

function Cell({ x, y, w = 26, h = 26, fill = '#e8e2d0' }: { x: number; y: number; w?: number; h?: number; fill?: string }) {
  return <rect x={x} y={y} width={w} height={h} fill={fill} stroke="#999" strokeWidth={1} />;
}

export function StartRuleIllustration() {
  return (
    <svg viewBox="0 0 140 70" width="100%" height="70">
      <Cell x={4} y={4} fill="#f3c9c9" />
      <Cell x={30} y={4} fill="#f3c9c9" />
      <Cell x={4} y={30} fill="#f3c9c9" />
      <Cell x={30} y={30} fill="#f3c9c9" />
      <Piece x={17} y={17} color="#ef5350" />
      <path d="M60 22 H90" stroke="#ddd" strokeWidth={2} markerEnd="url(#arrow)" />
      <Cell x={94} y={9} w={30} h={30} fill="#ef5350" />
      <text x={109} y={28} fontSize="9" fill="#fff" textAnchor="middle">
        START
      </text>
      <rect x={60} y={40} width={18} height={18} rx={3} fill="#fff" stroke="#333" />
      <circle cx={69} cy={49} r={2.2} fill="#333" />
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#ddd" />
        </marker>
      </defs>
    </svg>
  );
}

export function BlockRuleIllustration() {
  return (
    <svg viewBox="0 0 140 50" width="100%" height="50">
      <Cell x={4} y={12} />
      <Cell x={34} y={12} />
      <Cell x={64} y={12} />
      <Cell x={94} y={12} />
      <Piece x={17} y={25} color="#1565c0" />
      <Piece x={107} y={25} color="#ef5350" />
      <line x1={55} y1={4} x2={73} y2={38} stroke="#e53935" strokeWidth={3} />
      <line x1={73} y1={4} x2={55} y2={38} stroke="#e53935" strokeWidth={3} />
      <text x={70} y={48} fontSize="8" fill="#999" textAnchor="middle">
        あり: 通過不可
      </text>
    </svg>
  );
}

export function GoalRuleIllustration() {
  return (
    <svg viewBox="0 0 140 50" width="100%" height="50">
      <Cell x={4} y={12} fill="#cde3cf" />
      <Cell x={34} y={12} fill="#cde3cf" />
      <Cell x={64} y={12} fill="#cde3cf" />
      <Cell x={94} y={12} fill="#2e7d32" />
      <Piece x={47} y={25} color="#2e7d32" />
      <text x={109} y={30} fontSize="8" fill="#fff" textAnchor="middle">
        奥
      </text>
      <path d="M60 25 H82" stroke="#ddd" strokeWidth={2} markerEnd="url(#arrow2)" />
      <text x={70} y={46} fontSize="8" fill="#999" textAnchor="middle">
        残り2+目2=ピッタリ
      </text>
      <defs>
        <marker id="arrow2" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#ddd" />
        </marker>
      </defs>
    </svg>
  );
}

/** 動かし方: サイコロをふって、進むコマを選ぶ */
export function MoveIllustration() {
  return (
    <svg viewBox="0 0 140 60" width="100%" height="60">
      <rect x={6} y={20} width={18} height={18} rx={3} fill="#fff" stroke="#333" />
      <circle cx={11} cy={25} r={2} fill="#333" />
      <circle cx={19} cy={33} r={2} fill="#333" />
      <ellipse cx={70} cy={44} rx={16} ry={7} fill="none" stroke="#999" />
      <ellipse cx={108} cy={44} rx={16} ry={7} fill="none" stroke="#999" />
      <Piece x={70} y={28} color="#1565c0" />
      <path d="M82 30 Q95 15 100 30" stroke="#7ec6ff" strokeWidth={2} fill="none" markerEnd="url(#moveArrow)" />
      <defs>
        <marker id="moveArrow" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#7ec6ff" />
        </marker>
      </defs>
    </svg>
  );
}

/** アタック!: 相手のコマと同じマスに止まるとスタートにもどせる */
export function AttackIllustration() {
  return (
    <svg viewBox="0 0 140 70" width="100%" height="70">
      <ellipse cx={40} cy={55} rx={16} ry={7} fill="none" stroke="#999" />
      <Piece x={40} y={38} color="#1565c0" />
      <path
        d="M52 30 L56 22 L60 30 L68 26 L64 34 L72 38 L62 40 L64 48 L56 42 L52 50 L50 40 L42 42 L48 36 Z"
        fill="#ffd54f"
        stroke="#e0a800"
        strokeWidth={1}
      />
      <Piece x={92} y={28} color="#ef5350" />
      <path d="M92 40 Q70 55 46 55" stroke="#ef5350" strokeWidth={2} fill="none" strokeDasharray="3 3" markerEnd="url(#backArrow)" />
      <defs>
        <marker id="backArrow" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#ef5350" />
        </marker>
      </defs>
    </svg>
  );
}

/** 6が出たら: もう1回サイコロをふれる */
export function SixAgainIllustration() {
  return (
    <svg viewBox="0 0 140 60" width="100%" height="60">
      <rect x={20} y={12} width={30} height={30} rx={5} fill="#fff" stroke="#333" strokeWidth={1.5} />
      <circle cx={28} cy={20} r={2.4} fill="#333" />
      <circle cx={42} cy={20} r={2.4} fill="#333" />
      <circle cx={28} cy={27} r={2.4} fill="#333" />
      <circle cx={42} cy={27} r={2.4} fill="#333" />
      <circle cx={28} cy={34} r={2.4} fill="#333" />
      <circle cx={42} cy={34} r={2.4} fill="#333" />
      <path d="M62 27 H90" stroke="#ddd" strokeWidth={2} markerEnd="url(#again)" />
      <text x={76} y={20} fontSize="9" fill="#ddd" textAnchor="middle">
        もう1回
      </text>
      <defs>
        <marker id="again" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#ddd" />
        </marker>
      </defs>
    </svg>
  );
}

/** 基本の遊び方 / 最後は: 4つのコマをそろえてゴール */
export function GoalAllIllustration() {
  return (
    <svg viewBox="0 0 140 55" width="100%" height="55">
      {[20, 50, 80, 110].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={45} rx={14} ry={6} fill="none" stroke="#999" />
          <Piece x={x} y={30} color="#1565c0" />
          <path d={`M${x - 6} 16 L${x - 8} 10 M${x} 14 L${x} 6 M${x + 6} 16 L${x + 8} 10`} stroke="#7ec6ff" strokeWidth={1.5} />
        </g>
      ))}
    </svg>
  );
}

export function EndRuleIllustration() {
  return (
    <svg viewBox="0 0 140 50" width="100%" height="50">
      <Piece x={20} y={20} color="#f9a825" />
      <text x={20} y={40} fontSize="9" fill="#ccc" textAnchor="middle">
        1位
      </text>
      <Piece x={55} y={20} color="#ef5350" />
      <text x={55} y={40} fontSize="9" fill="#ccc" textAnchor="middle">
        2位
      </text>
      <Piece x={90} y={20} color="#1565c0" />
      <text x={90} y={40} fontSize="9" fill="#ccc" textAnchor="middle">
        3位
      </text>
      <Piece x={125} y={20} color="#2e7d32" />
      <text x={125} y={40} fontSize="9" fill="#ccc" textAnchor="middle">
        4位
      </text>
    </svg>
  );
}
