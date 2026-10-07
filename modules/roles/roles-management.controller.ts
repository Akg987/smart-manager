import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
} from "@nestjs/common";
import { ApiBearerAuth, ApiParam, ApiTags } from "@nestjs/swagger";
import {
	ApiErrors,
	ApiListEnvelope,
	ApiMessageEnvelope,
	ApiResourceEnvelope,
	Err,
	itemsResult,
	MessageResults,
	withAdmin,
} from "../../common/http/index";
import { Permissions } from "../auth/decorators/permissions.decorator";
import {
	CreateRoleDto,
	RoleDto,
	SetRolePermissionsDto,
	UpdateRoleDto,
} from "./dto/roles.dto";
import { ROLE_PERMISSIONS } from "./roles.permissions";
import { toRoleDto } from "./roles.presenter";
import { RolesService } from "./roles.service";

@ApiTags("roles-management")
@ApiBearerAuth()
@Controller({ path: "roles-management", version: "1" })
export class RolesManagementController {
	constructor(private readonly roles: RolesService) {}

	@Get()
	@Permissions(ROLE_PERMISSIONS.read)
	@ApiListEnvelope(RoleDto, { paginated: false })
	@ApiErrors(...withAdmin())
	async list() {
		const rows = await this.roles.list();
		return itemsResult(rows.map(toRoleDto));
	}

	@Get(":key")
	@Permissions(ROLE_PERMISSIONS.read)
	@ApiParam({ name: "key", example: "seller" })
	@ApiResourceEnvelope(RoleDto)
	@ApiErrors(
		...withAdmin(
			Err.invalidInput("invalid role key", "invalidKey"),
			Err.notFound("role not found"),
		),
	)
	async get(@Param("key") key: string) {
		return toRoleDto(await this.roles.getByKey(key));
	}

	@Post()
	@Permissions(ROLE_PERMISSIONS.create)
	@HttpCode(HttpStatus.CREATED)
	@ApiResourceEnvelope(RoleDto, 201, "Created role")
	@ApiErrors(
		...withAdmin(
			Err.invalidInput("invalid role key", "invalidKey"),
			Err.invalidInput("role name is required", "nameRequired"),
			Err.invalidInput("duplicate role", "duplicateRole"),
			Err.invalidInput("unknown permission", "unknownPermission"),
		),
	)
	async create(@Body() body: CreateRoleDto) {
		const row = await this.roles.create(body);
		return toRoleDto(row);
	}

	@Put(":key")
	@Permissions(ROLE_PERMISSIONS.update)
	@HttpCode(HttpStatus.OK)
	@ApiParam({ name: "key", example: "seller" })
	@ApiResourceEnvelope(RoleDto)
	@ApiErrors(
		...withAdmin(
			Err.invalidInput("invalid role key", "invalidKey"),
			Err.invalidInput("role name is required", "nameRequired"),
			Err.notFound("role not found"),
		),
	)
	async update(@Param("key") key: string, @Body() body: UpdateRoleDto) {
		const row = await this.roles.update(key, body);
		return toRoleDto(row);
	}

	@Put(":key/permissions")
	@Permissions(ROLE_PERMISSIONS.assignPermissions)
	@HttpCode(HttpStatus.OK)
	@ApiParam({ name: "key", example: "seller" })
	@ApiResourceEnvelope(RoleDto)
	@ApiErrors(
		...withAdmin(
			Err.invalidInput("invalid role key", "invalidKey"),
			Err.notFound("role not found"),
			Err.invalidInput("unknown permission", "unknownPermission"),
			Err.invalidInput(
				"system permission cannot be removed",
				"systemPermission",
			),
		),
	)
	async setPermissions(
		@Param("key") key: string,
		@Body() body: SetRolePermissionsDto,
	) {
		const row = await this.roles.setPermissions(key, body.permissions);
		return toRoleDto(row);
	}

	@Delete(":key")
	@Permissions(ROLE_PERMISSIONS.delete)
	@HttpCode(HttpStatus.OK)
	@ApiParam({ name: "key", example: "support" })
	@ApiMessageEnvelope("deleted")
	@ApiErrors(
		...withAdmin(
			Err.invalidInput("invalid role key", "invalidKey"),
			Err.notFound("role not found"),
			Err.conflict("system role cannot be deleted", "systemRole"),
		),
	)
	async delete(@Param("key") key: string) {
		await this.roles.remove(key);
		return MessageResults.deleted();
	}
}
