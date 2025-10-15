import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ApAuthGuard } from 'src/modules/auth/auth-guard.decorator';
import { CreateUserDTO } from './user.dto';
import * as userModel from './user.model';
import { UserService } from './user.service';

@ApiTags('User Modules')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('createUser')
  @ApiOperation({
    summary: 'Create a new user',
    description: 'Creates a new user in Firebase Auth and Firestore.',
  })
  @ApiResponse({ status: 201, description: 'User successfully created.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 409, description: 'User already exists.' })
  @ApiBody({ type: CreateUserDTO }) // Tells Swagger the request body type
  @UsePipes(new ValidationPipe({ transform: true }))
  createUser(@Body() model: CreateUserDTO) {
    return this.userService.create(model);
  }

  @Get('all')
  @ApiOperation({
    summary: 'Get all users',
    description: 'Fetch all users from Firestore.',
  })
  @ApiResponse({ status: 200, description: 'List of users.' })
  @ApAuthGuard(userModel.UserRole.ADMIN)
  findAll() {
    return this.userService.findAll();
  }

  @Get()
  @ApiOperation({
    summary: 'Get paginated users',
    description:
      'Get users with server-side pagination. Query params: page (1-based), limit, q (search)',
  })
  @ApAuthGuard(userModel.UserRole.ADMIN)
  findPaginated(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('q') q?: string,
  ) {
    const p = Math.max(1, Number.isNaN(Number(page)) ? 1 : Number(page));
    const l = Math.max(1, Number.isNaN(Number(limit)) ? 10 : Number(limit));
    return this.userService.findPaginated(p, l, q);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a user by ID',
    description: 'Fetch a single user from Firestore by their ID.',
  })
  @ApiResponse({ status: 200, description: 'User found.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a user by ID',
    description: 'Update a single user in Firestore by their ID.',
  })
  @ApiResponse({ status: 200, description: 'User updated.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApAuthGuard(userModel.UserRole.ADMIN)
  update(@Param('id') id: string, @Body() updateUserDto: userModel.UserDoc) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a user by ID',
    description: 'Remove a single user from Firestore by their ID.',
  })
  @ApiResponse({ status: 200, description: 'User deleted.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApAuthGuard(userModel.UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }
}
