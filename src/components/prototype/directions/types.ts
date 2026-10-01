/** PROTOTYPE — props every direction receives from the prototype page. */
export type ProtoView = 'host' | 'guest'

export interface DirectionProps {
  view: ProtoView
  setView: (view: ProtoView) => void
}
