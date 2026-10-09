import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

const idPattern = /^[1-9]\d*$/;

export class CreateCompanyDto {
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsString()
  @MinLength(2)
  @MaxLength(48)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  code!: string;
  @IsOptional() @IsString() @MaxLength(32) calendar?: string;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
}

export class CreateBranchDto {
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsString()
  @MinLength(2)
  @MaxLength(48)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  code!: string;
}

export class CreateBusinessUnitDto {
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsString()
  @MinLength(2)
  @MaxLength(48)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  code!: string;
  @IsOptional() @Matches(idPattern) branchId?: string | null;
  @IsOptional() @IsString() @MaxLength(64) domain?: string;
}

export class UpdateBranchDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) name?: string;
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(48)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  code?: string;
}

export class UpdateBusinessUnitDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) name?: string;
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(48)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  code?: string;
  @IsOptional() @Matches(idPattern) branchId?: string | null;
  @IsOptional() @IsString() @MaxLength(64) domain?: string;
}

export class AssignMembershipDto {
  @Matches(idPattern) userId!: string;
  @IsOptional() @Matches(idPattern) companyId?: string;
  @IsOptional() @Matches(idPattern) branchId?: string;
  @IsOptional() @Matches(idPattern) businessUnitId?: string;
  @IsIn(["company", "branch", "businessUnit"]) scopeType!:
    | "company"
    | "branch"
    | "businessUnit";
  @IsArray()
  @ArrayMinSize(1)
  @Matches(idPattern, { each: true })
  roleIds!: string[];
}

export class CreateInvitationDto {
  @IsString() @Matches(/^09\d{9}$/) mobile!: string;
  @Matches(idPattern) roleId!: string;
  @IsOptional() @Matches(idPattern) companyId?: string;
}

export class AcceptInvitationDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) token!: string;
}
