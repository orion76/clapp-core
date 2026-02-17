import { Type } from '../types';

export interface IProvider {
    provide: string;
}
export interface IProviderWithDeps {
    deps?: string[];
}
export interface IProvideClass<T extends unknown = unknown> extends IProvider, IProviderWithDeps {
    useClass: Type<T>;
}

export interface IProvideValue<T extends unknown = unknown> extends IProvider {
    useValue: T;
}

export type TFactory<T> = (...args: any[]) => T;

export interface IProvideFactory<T extends unknown = unknown> extends IProvider, IProviderWithDeps {
    useFactory: TFactory<T>;
}

export type UProvider = IProvideClass | IProvideValue | IProvideFactory;
