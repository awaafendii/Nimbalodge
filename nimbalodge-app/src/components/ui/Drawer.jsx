import { IconClose } from "../icons/Icons.jsx";

export function Drawer({ open, onClose, title, footer, children }) {
  return (
    <>
      <div className={"drawer-scrim" + (open ? " show" : "")} onClick={onClose} />
      <div className={"drawer" + (open ? " show" : "")} aria-hidden={!open}>
        <div className="drawer-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            <IconClose />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer ? <div className="drawer-foot">{footer}</div> : null}
      </div>
    </>
  );
}
