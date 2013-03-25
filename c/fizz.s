	.file	"fizz.c"
	.global	__modsi3
	.text
	.align	2
	.global	main
	.type	main, %function
main:
	@ args = 0, pretend = 0, frame = 108
	@ frame_needed = 1, uses_anonymous_args = 0
	stmfd	sp!, {fp, lr}
	add	fp, sp, #4
	sub	sp, sp, #108
	mov	r3, #0
	str	r3, [fp, #-8]
	b	.L2
.L5:
	mov	r3, #0
	strb	r3, [fp, #-9]
	ldr	r3, [fp, #-8]
	mov	r0, r3
	mov	r1, #3
	bl	__modsi3
	mov	r3, r0
	cmp	r3, #0
	bne	.L3
	ldrb	r3, [fp, #-9]
	orr	r3, r3, #1
	strb	r3, [fp, #-9]
.L3:
	ldr	r3, [fp, #-8]
	mov	r0, r3
	mov	r1, #5
	bl	__modsi3
	mov	r3, r0
	cmp	r3, #0
	bne	.L4
	ldrb	r3, [fp, #-9]
	orr	r3, r3, #2
	strb	r3, [fp, #-9]
.L4:
	mvn	r3, #107
	ldr	r2, [fp, #-8]
	sub	r1, fp, #4
	add	r2, r1, r2
	add	r3, r2, r3
	ldrb	r2, [fp, #-9]
	strb	r2, [r3, #0]
	ldr	r3, [fp, #-8]
	add	r3, r3, #1
	str	r3, [fp, #-8]
.L2:
	ldr	r3, [fp, #-8]
	cmp	r3, #99
	ble	.L5
	sub	sp, fp, #4
	ldmfd	sp!, {fp, pc}
	.size	main, .-main
	.ident	"GCC: (GNU) 4.7.2"
