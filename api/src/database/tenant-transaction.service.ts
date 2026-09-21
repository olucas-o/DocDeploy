import { Injectable } from "@nestjs/common";
import { DataSource, type EntityManager } from "typeorm";

@Injectable()
export class TenantTransactionService {
  constructor(private readonly dataSource: DataSource) {}

  async run<T>(organizationId: string, operation: (manager: EntityManager) => Promise<T>): Promise<T> {
    if (!/^[0-9a-f-]{36}$/i.test(organizationId)) throw new Error("Invalid organization context");
    return this.dataSource.transaction(async (manager) => {
      await manager.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
      return operation(manager);
    });
  }
}
