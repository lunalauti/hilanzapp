import { afterEach, describe, expect, it } from 'vitest';
import { deleteCookie, getCookie, setCookie } from './cookies';

describe('cookies', () => {
  afterEach(() => deleteCookie('prueba'));

  it('guarda y lee una cookie', () => {
    setCookie('prueba', '1', 30);
    expect(getCookie('prueba')).toBe('1');
  });

  it('devuelve null si no existe', () => {
    expect(getCookie('no_existe')).toBeNull();
  });

  it('no confunde cookies con nombres parecidos', () => {
    setCookie('prueba', 'a', 30);
    setCookie('prueba_larga', 'b', 30);
    expect(getCookie('prueba')).toBe('a');
    expect(getCookie('prueba_larga')).toBe('b');
    deleteCookie('prueba_larga');
  });

  it('codifica y decodifica valores con caracteres especiales', () => {
    setCookie('prueba', 'a b;c=d', 30);
    expect(getCookie('prueba')).toBe('a b;c=d');
  });

  it('borra la cookie', () => {
    setCookie('prueba', '1', 30);
    deleteCookie('prueba');
    expect(getCookie('prueba')).toBeNull();
  });
});
