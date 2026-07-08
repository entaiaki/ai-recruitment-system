"""权限依赖 — 统一角色检查，消除路由里的重复代码"""
from fastapi import Depends, HTTPException, status
from app.models.user import User, UserRole
from app.core.security import get_current_active_user


def require_roles(*roles: UserRole):
    """
    用法：current_user: User = Depends(require_roles(UserRole.admin, UserRole.hr))
    只允许指定角色访问，其余一律 403。
    """
    async def checker(
        current_user: User = Depends(get_current_active_user),
    ) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"需要权限：{[r.value for r in roles]}，当前角色：{current_user.role.value}",
            )
        return current_user
    return checker


# 预定义组合，直接 Depends 不用传参
require_admin       = require_roles(UserRole.admin)
require_hr_or_above = require_roles(UserRole.admin, UserRole.hr)
require_any_staff   = require_roles(UserRole.admin, UserRole.hr, UserRole.dept_leader)
