import type { PerfilUsuario } from "../aggregates";
import type { ProfileId, UserEmail } from "../value-objects";

export interface PerfilUsuarioRepository {
  findById(id: ProfileId): Promise<PerfilUsuario | null>;
  findByEmail(email: UserEmail): Promise<PerfilUsuario | null>;
}
