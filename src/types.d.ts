interface Memory {
  uuid: number;
  log: any;
}

type sMap<K extends string | number | symbol, V> = {
  [key in K]: V;
};

declare namespace NodeJS {
  interface Global {
    log: any;
  }
}
