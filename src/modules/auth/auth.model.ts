import { UserModel } from '../user/user.model';

export class TokenResponse {
  idToken: string;
  refreshToken: string;
  expiresIn: string;
  localId: string;
  displayName: string;
  user: UserModel;
}
