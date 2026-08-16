export function Card({ children, className = "", ...rest }) {
  return (
    <div className={"card " + className} {...rest}>
      {children}
    </div>
  );
}

export function CardHead({ title, hint, right, children }) {
  return (
    <div className="card-head">
      <h3>{title}</h3>
      {right ? right : hint ? <span className="hint">{hint}</span> : null}
      {children}
    </div>
  );
}
