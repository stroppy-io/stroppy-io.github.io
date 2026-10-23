import type {ComponentType, CSSProperties, SVGProps} from 'react';
import {usePluginData} from '@docusaurus/useGlobalData';
import CockroachLabs from '@thesvg/react/cockroach-labs';
import Mariadb from '@thesvg/react/mariadb';
import Mysql from '@thesvg/react/mysql';
import Postgresql from '@thesvg/react/postgresql';
import Orioledb from './logos/orioledb.svg';
import Picodata from './logos/picodata.svg';
import Ydb from './logos/ydb.svg';
import {reach, type Catalog} from './rating';

// The engines Stroppy Cloud deploys, as a strip of their marks along the
// bottom of the hero, moving slowly sideways. The list and the counts come
// from the build's copy of the cloud's catalog. Marks are one colour, the
// text's: the four from theSVG's mono set, the other three traced from each
// project's own logo (logos/).

type Mark = ComponentType<SVGProps<SVGSVGElement> & {variant?: string}>;

// MySQL's mono mark is the dolphin over the word "MySQL"; the strip shows
// the name itself, so only the dolphin is cropped in.
const MARKS: Record<string, {Mark: Mark; variant?: string; viewBox?: string}> = {
  postgres: {Mark: Postgresql, variant: 'mono'},
  orioledb: {Mark: Orioledb},
  mysql: {Mark: Mysql, variant: 'mono', viewBox: '13.6 3.2 10.4 10.4'},
  mariadb: {Mark: Mariadb, variant: 'mono'},
  cockroach: {Mark: CockroachLabs, variant: 'mono'},
  ydb: {Mark: Ydb},
  picodata: {Mark: Picodata},
};

function Row({dbs, hidden}: {dbs: {kind: string; title: string}[]; hidden?: boolean}) {
  return (
    <ul className="engines__row" aria-hidden={hidden || undefined}>
      {dbs.map(({kind, title}) => {
        const m = MARKS[kind];
        return (
          <li key={kind} className="engines__item">
            {m && (
              <m.Mark
                className="engines__mark"
                aria-hidden="true"
                {...(m.variant && {variant: m.variant})}
                {...(m.viewBox && {viewBox: m.viewBox})}
              />
            )}
            <span>{title}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default function Engines() {
  const {catalog} = usePluginData('cloud-rating') as {catalog: Catalog | null};
  if (!catalog) return null;
  const r = reach(catalog);
  return (
    <div className="engines">
      <p className="engines__caption">
        {r.engines} engines · {r.versions} versions · {r.topologies} topologies, every result reproducible
      </p>
      <div className="engines__track" style={{'--n': String(r.dbs.length)} as CSSProperties}>
        <div className="engines__slide">
          <Row dbs={r.dbs} />
          <Row dbs={r.dbs} hidden />
        </div>
      </div>
    </div>
  );
}
