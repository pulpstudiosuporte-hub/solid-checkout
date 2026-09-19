import './glow-horizon.css';

// Original horizon composition: white rim, two red light layers and a dark core.
export default function GlowHorizon() {
  return <div className="site-horizon-background" aria-hidden="true"><div className="horizon-enter"><i className="horizon-rim"/><i className="horizon-soft"/><i className="horizon-red"/><i className="horizon-core"/></div></div>;
}
