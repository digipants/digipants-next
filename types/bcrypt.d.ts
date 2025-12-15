declare module "bcrypt" {
  type Callback<T> = (error: Error | undefined, result: T) => void;

  export function genSalt(rounds?: number): Promise<string>;
  export function genSalt(rounds: number, minor: string): Promise<string>;
  export function genSalt(rounds: number, callback: Callback<string>): void;
  export function genSalt(rounds: number, minor: string, callback: Callback<string>): void;
  export function genSaltSync(rounds?: number, minor?: string): string;

  export function hash(
    data: string | Buffer,
    saltOrRounds: string | number,
  ): Promise<string>;
  export function hash(
    data: string | Buffer,
    saltOrRounds: string | number,
    callback: Callback<string>,
  ): void;
  export function hashSync(data: string | Buffer, saltOrRounds: string | number): string;

  export function compare(data: string | Buffer, encrypted: string): Promise<boolean>;
  export function compare(
    data: string | Buffer,
    encrypted: string,
    callback: Callback<boolean>,
  ): void;
  export function compareSync(data: string | Buffer, encrypted: string): boolean;

  export function getRounds(encrypted: string): number;
  export function setRandomFallback(random: (length: number) => Buffer): void;

  export const version: string;
}
