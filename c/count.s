	.file	"count.c"
	.text
	.align	2
	.global	main
	.type	main, %function
main:
	@ args = 0, pretend = 0, frame = 8
	@ frame_needed = 0, uses_anonymous_args = 0
	@ link register save eliminated.
	sub	sp, sp, #8
	mov	r3, #0
	str	r3, [sp, #0]
	b	.L2
.L3:
	ldr	r2, [sp, #4]
	ldr	r3, [sp, #0]
	add	r3, r2, r3
	str	r3, [sp, #4]
	ldr	r3, [sp, #0]
	add	r3, r3, #1
	str	r3, [sp, #0]
.L2:
	ldr	r3, [sp, #0]
	cmp	r3, #99
	ble	.L3
	ldr	r3, [sp, #4]
	mov	r0, r3
	add	sp, sp, #8
	mov	pc, lr
	.size	main, .-main
	.ident	"GCC: (GNU) 4.7.2"
