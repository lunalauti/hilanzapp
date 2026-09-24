import type { ReactNode } from 'react';

export interface OnboardingStep { icon: string; title: string; body: ReactNode }

const Legend = () => (
  <div className="hz-onb-legend" aria-label="Cómo distinguir los datos">
    <div><span className="hz-real hz-onb-sample">88 cm</span><span><strong>Medida real</strong> — la que tomaste con la cinta. Nunca se pisa.</span></div>
    <div><span className="hz-calc hz-onb-sample">22 cm</span><span><strong>Resultado del molde</strong> — calculado a partir de la medida real.</span></div>
    <div><span className="hz-sug hz-onb-sample">T42 SUG.</span><span><strong>Talle sugerido</strong> — lo propone la app.</span></div>
    <div><span className="hz-manual hz-onb-sample">T44 ✎</span><span><strong>Talle a mano</strong> — lo decidís vos y manda siempre.</span></div>
  </div>
);

export const STEPS: OnboardingStep[] = [
  {
    icon: 'bi-scissors',
    title: 'Bienvenida a Hilanzapp',
    body: (
      <>
        <p>Una idea guía: <strong>medidas reales para construir el molde; talles para organizar la producción</strong>.</p>
        <p>Vas a ver cuatro tipos de datos, cada uno con su propio aspecto:</p>
        <Legend />
      </>
    ),
  },
  {
    icon: 'bi-people',
    title: 'Grupos y bailarinas',
    body: (
      <>
        <p>Empezá creando un <strong>grupo</strong> (Ágata, Jade…) y agregá a sus bailarinas.</p>
        <p>Cargá la <strong>edad</strong> de cada una: define qué tabla de talles se usa (bebés, niñas, adolescentes o adultas).</p>
        <p className="text-secondary mb-0">En la lista del grupo ves de un vistazo el estado de las medidas, el talle y las prendas.</p>
      </>
    ),
  },
  {
    icon: 'bi-rulers',
    title: 'Cargá las medidas',
    body: (
      <>
        <p>En la ficha, tocá un campo y escribí la medida en centímetros. Podés usar <strong>coma o punto</strong> (88,5). Se guarda sola al salir del campo o con Enter.</p>
        <p>Cada cambio queda en el <strong>historial</strong>: podés ver valores anteriores, restaurarlos y comparar dos tomas.</p>
        <p className="text-secondary mb-0">¿Una medida que no está en la lista? Agregá una <strong>medida personalizada</strong> con nombre y observación.</p>
      </>
    ),
  },
  {
    icon: 'bi-tags',
    title: 'Talle sugerido, siempre editable',
    body: (
      <>
        <p>La app compara pecho, cintura y cadera con la tabla y te muestra <strong>qué talle da cada medida</strong>. Para vestidos y remeras manda el pecho; para faldas y pantalones, la cadera.</p>
        <p>Podés elegir otro talle a mano, en general o <strong>por prenda</strong>. El sugerido se conserva al lado.</p>
        <p className="text-secondary mb-0">Los moldes siempre se calculan con tus medidas reales, no con el talle.</p>
      </>
    ),
  },
  {
    icon: 'bi-calculator',
    title: 'La hoja de molde',
    body: (
      <>
        <p>Elegí bailarina y molde: ves la <strong>medida real, la fórmula y el resultado</strong> lado a lado, sin hacer cuentas.</p>
        <p>Algunos moldes piden un dato que sale del dibujo, como la <strong>sisa</strong> o el largo de canesú.</p>
        <p className="text-secondary mb-0">Si falta una medida, la hoja te dice cuál y te lleva a cargarla. Podés guardarla, imprimirla en A4 o usar el modo mesa de corte.</p>
      </>
    ),
  },
  {
    icon: 'bi-list-check',
    title: 'Producción por talle',
    body: (
      <>
        <p>En la pestaña <strong>Producción</strong> de cada grupo ves cuántas prendas de cada talle hay que cortar.</p>
        <p>Tocá un talle para ver <strong>quiénes son</strong> y cortarlas juntas. Las bailarinas sin prenda o sin medidas quedan como pendientes.</p>
        <p className="text-secondary mb-0">Podés volver a ver este tutorial cuando quieras desde Ajustes.</p>
      </>
    ),
  },
];
