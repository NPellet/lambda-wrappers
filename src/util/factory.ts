export abstract class StdController {
  static async init(secrets: any) {
    const that = new (this as any)();
    return that;
  }
}
